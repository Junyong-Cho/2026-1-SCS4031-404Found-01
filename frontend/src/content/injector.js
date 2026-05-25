// src/content/injector.js
import {
  getConfig,
  extractLcId,
  applyBlurAndSkeleton,
  renderCleanResults,
  renderCleanResult,
  restoreAllComments,
  cleanCache,
  querySelectorWithFallback,
} from "./cleaner.js";
import "./injector.css";
import "./feedback/feedback.css";

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(to right, #ff5f6d, #ffc371)",
    color: "white",
    padding: "10px 20px",
    borderRadius: "10px",
    zIndex: "999999",
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

let commentQueue = [];
const processedIds = new Set();
const observationTimers = new Map();

const MAX_BATCH_SIZE = 15; // 한 번에 보낼 최대 댓글 수

/**
 * 큐 처리 로직 (설정에 따라 분기)
 */
const MAX_RETRY = 2; // 최대 재시도 횟수

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePersonalKeywords(text, personalKeywords) {
  const sanitizedText = personalKeywords?.reduce((currentText, keyword) => {
    if (!keyword) return currentText;
    const regex = new RegExp(escapeRegExp(keyword), "g");
    return currentText.replace(regex, "아잉");
  }, text);

  const foundKeywords =
    personalKeywords?.filter((keyword) => {
      if (!keyword) return false;
      return text.includes(keyword);
    }) || [];

  return { text: sanitizedText, foundKeywords };
}

function getCommentText(container, config) {
  const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");
  return commentEl?.innerText.trim() || "";
}

function shouldSkipBlur(container) {
  return container.dataset.userRevealed === "true";
}

function queueComment(container, config, rawText, personalKeywords) {
  const lcId = container.getAttribute("data-lc-id");
  if (!lcId || !rawText) return;

  if (!container.dataset.originalText) {
    container.dataset.originalText = rawText;
  }

  const { text, foundKeywords } = replacePersonalKeywords(rawText, personalKeywords);
  if (foundKeywords.length > 0) {
    const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
    if (commentSpan) commentSpan.textContent = text;
    container.dataset.localSanitizedText = text;
  } else {
    delete container.dataset.localSanitizedText;
  }

  if (!processedIds.has(lcId)) {
    if (!shouldSkipBlur(container)) {
      applyBlurAndSkeleton(container, config);
    }
    commentQueue.push({ id: lcId, text });
    processedIds.add(lcId);
  }
}

function queueCommentByContainer(container, config, personalKeywords) {
  const rawText = getCommentText(container, config);
  queueComment(container, config, rawText, personalKeywords);
}

function reprocessCommentsForKeywordChange(config, oldKeywords = [], newKeywords = []) {
  const addedKeywords = newKeywords.filter((k) => !oldKeywords.includes(k));
  const removedKeywords = oldKeywords.filter((k) => !newKeywords.includes(k));
  if (addedKeywords.length === 0 && removedKeywords.length === 0) return;

  document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
    const lcId = container.getAttribute("data-lc-id");
    if (!lcId) return;

    const originalText = container.dataset.originalText || getCommentText(container, config);
    if (!originalText) return;

    const hasAdded = addedKeywords.some((keyword) => originalText.includes(keyword));
    const hasRemoved = removedKeywords.some((keyword) => originalText.includes(keyword));
    if (!hasAdded && !hasRemoved) return;

    cleanCache.delete(lcId);
    processedIds.delete(lcId);
    delete container.dataset.userRevealed;

    const { text, foundKeywords } = replacePersonalKeywords(originalText, newKeywords);
    if (foundKeywords.length > 0) {
      const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
      if (commentSpan) commentSpan.textContent = text;
      container.dataset.localSanitizedText = text;
    } else {
      delete container.dataset.localSanitizedText;
    }

    if (!shouldSkipBlur(container)) {
      applyBlurAndSkeleton(container, config);
    }
    commentQueue.push({ id: lcId, text });
    processedIds.add(lcId);
  });

  if (commentQueue.length > 0) {
    flushQueue();
  }
}

const flushQueue = async () => {
  // 1. 브라우저 컨텍스트 유실 방어
  if (!chrome || !chrome.runtime || !chrome.runtime.id) return;

  const settings = await chrome.storage.local.get(["serviceActive", "filterStep"]);
  if (!settings.serviceActive || commentQueue.length === 0) return;

  // 2. 큐에서 분석할 청크 추출
  const chunk = commentQueue.splice(0, MAX_BATCH_SIZE);

  // 3. 백엔드 스웨거 명세서 양식 완벽 일치 (comments 배열만 최상위에 전송)
  const payload = {
    comments: chunk.map((c) => ({
      id: String(c.id),
      text: String(c.text),
    })),
  };

  // 요청 데이터 콘솔 출력
  console.log("[댓글세탁소] 서버 전송 데이터 (Request Body)", JSON.stringify(payload, null, 2));

  // 4. 백그라운드로 전송
  chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
    // runtime.lastError 및 예외 방어
    if (chrome.runtime.lastError || !response || response.error) {
      console.error("[청크 전송 실패] 재시도 큐에 반환합니다.", chrome.runtime.lastError || response?.error);

      const retryChunk = chunk
        .map((c) => ({ ...c, _retryCount: (c._retryCount || 0) + 1 }))
        .filter((c) => c._retryCount <= MAX_RETRY);

      if (retryChunk.length > 0) {
        commentQueue.unshift(...retryChunk);
      }
      return;
    }

    // 성공 시 화면 처리 연동
    if (response && response.results) {
      console.log("[댓글세탁소] 서버 응답 데이터 (Response Body)", JSON.stringify(response, null, 2));

      // 🌟 서버가 단계를 안 받으므로, 프론트의 설정을 응답 객체에 직접 합성해서 넘겨줌
      const currentStep = settings.filterStep ?? 1; // 1: blur, 2: refine

      const enrichedResponse = {
        ...response,
        results: response.results.map((item) => ({
          ...item,
          filterStep: currentStep, // 개별 결과물에 현재 사용자의 필터 단계 매핑 주입
        })),
      };

      if (typeof renderCleanResults === "function") {
        renderCleanResults(enrichedResponse);
      }
    }
  });
};

/**
 * 댓글 감지 및 데이터 추출
 */
function initObservation() {
  const config = getConfig();
  if (!config) return;

  const newContainers = document.querySelectorAll(`${config.container}:not([data-observed])`);

  if (newContainers.length === 0) return;

  newContainers.forEach((container) => {
    const linkEl = querySelectorWithFallback(container, config.link, "commentLink");
    const lcId = extractLcId(linkEl?.getAttribute("href"));

    if (!linkEl || !lcId) {
      console.warn("[DOM 매핑 경고] 댓글 컨테이너는 발견했으나 ID(lcId) 추출에 실패했습니다.", {
        container,
        lcId,
      });
      return;
    }

    container.setAttribute("data-lc-id", lcId);
    container.setAttribute("data-observed", "true");
    commentObserver.observe(container);
  });
}

/**
 * 화면 노출 감지 즉시 블러 처리 + 체류 후 큐 삽입
 */
const commentObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(async (entry) => {
      const target = entry.target;
      const lcId = target.getAttribute("data-lc-id");
      const config = getConfig();

      if (entry.isIntersecting) {
        const { serviceActive, personalKeywords = [] } = await chrome.storage.local.get([
          "serviceActive",
          "personalKeywords",
        ]);
        if (!serviceActive) return;

        // 1. 이미 처리 완료(캐시)되었거나 현재 큐에서 대기 중(processedIds)이면
        if (cleanCache.has(lcId) || processedIds.has(lcId)) {
          // 캐시에 있는 경우에만 '화면 업데이트'를 위해 한 번 호출하고 끝냄
          if (cleanCache.has(lcId)) {
            renderCleanResult(cleanCache.get(lcId), target, config);
          }
          return; // 처리 중인 댓글은 여기서 바로 종료 (applyBlur~ 호출 안 함)
        }

        // 1. 즉시 블러 실행
        if (!shouldSkipBlur(target)) {
          applyBlurAndSkeleton(target, config);
        }

        if (observationTimers.has(target)) {
          clearTimeout(observationTimers.get(target));
        }

        // 2. 0.8초 체류 확인 후 큐 삽입
        const timer = setTimeout(() => {
          if (processedIds.has(lcId)) return;

          const commentEl = querySelectorWithFallback(target, config.comment, "commentBody");
          if (commentEl) {
            let text = commentEl.innerText.trim();
            const sanitized = replacePersonalKeywords(text, personalKeywords);

            if (!target.dataset.originalText) {
              target.dataset.originalText = text;
            }

            if (sanitized.foundKeywords.length > 0) {
              const commentSpan = querySelectorWithFallback(target, config.commentSpan, "commentSpan");
              if (commentSpan) commentSpan.textContent = sanitized.text;
              target.dataset.localSanitizedText = sanitized.text;
            } else {
              delete target.dataset.localSanitizedText;
            }

            if (!processedIds.has(lcId)) {
              if (!shouldSkipBlur(target)) {
                applyBlurAndSkeleton(target, config);
              }
              commentQueue.push({
                id: lcId,
                text: sanitized.text,
              });
              processedIds.add(lcId);
            }
            observationTimers.delete(target);
          }
        }, 800);

        observationTimers.set(target, timer);
      } else {
        // 화면에서 사라지면 타이머 제거
        const timer = observationTimers.get(target);
        if (timer) {
          clearTimeout(timer);
          observationTimers.delete(target);
        }
      }
    });
  },
  { threshold: 0.1 },
);

/**
 * 에러 방지용 안전 초기화
 */
const startService = async () => {
  const config = getConfig();
  if (!config || !config.container) {
    setTimeout(startService, 200); // 0.2초 후 재시도
    return;
  }

  const { serviceActive } = await chrome.storage.local.get("serviceActive");
  if (serviceActive) initObservation();

  // 유튜브의 동적 댓글 로딩 감시
  const domObserver = new MutationObserver(initObservation);
  domObserver.observe(document.body, { childList: true, subtree: true });
};

// 메시지 수신 핸들러
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "TOGGLE_SERVICE") {
    if (msg.active) {
      reprocessAllVisibleComments();
      initObservation();
    } else {
      commentQueue = [];
      restoreAllComments(getConfig());
    }
    sendResponse({ status: "반영 완료" });
  }
  if (msg.action === "SHOW_TOAST") {
    showToast(msg.message);
  }
});

// 설정 변경 감지 (단계 변경 + 금지어 변경)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  const config = getConfig();

  // 1. 단계(filterStep)가 바뀐 경우 -> 기존 캐시 활용해서 화면만 다시 그림
  if (changes.filterStep) {
    const newStep = changes.filterStep.newValue;
    console.log("[설정 변경] 단계가 변경되었습니다. 캐시 데이터로 화면을 갱신합니다.");

    document.querySelectorAll("[data-lc-id]").forEach((container) => {
      const lcId = container.getAttribute("data-lc-id");
      const cached = cleanCache.get(lcId);
      if (!cached) return;

      cached.filterStep = newStep;
      renderCleanResult(cached, container, config);
    });
  }

  // 2. 금지어(personalKeywords)가 바뀐 경우 -> 캐시 싹 비우고 서버에 재요청
  if (changes.personalKeywords) {
    const oldKeywords = changes.personalKeywords.oldValue || [];
    const newKeywords = changes.personalKeywords.newValue || [];
    console.log("[설정 변경] 금지어가 추가/삭제되었습니다. 관련 댓글만 선별 재처리합니다.");

    reprocessCommentsForKeywordChange(config, oldKeywords, newKeywords);
  }
});

// 1.5초 주기로 서버 전송
setInterval(flushQueue, 1500);

// 즉시 실행
startService();

/**
 * 현재 화면에 보이는 모든 댓글을 다시 분석 큐에 넣음
 * (서비스 시작, 금지어 변경 시 사용)
 */
async function reprocessAllVisibleComments() {
  const config = getConfig();
  processedIds.clear(); // 기존 처리 기록 초기화 (캐시는 유지하되 새로고침 시엔 clear 가능)

  const { personalKeywords = [] } = await chrome.storage.local.get("personalKeywords");

  document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
    const lcId = container.getAttribute("data-lc-id");

    // 캐시에 있다면 바로 렌더링
    if (cleanCache.has(lcId)) {
      renderCleanResult(cleanCache.get(lcId), container, config);
      return;
    }

    if (processedIds.has(lcId)) return;

    const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");
    if (commentEl) {
      const rawText = commentEl.innerText.trim();
      queueComment(container, config, rawText, personalKeywords);
      processedIds.add(lcId);
    }
  });

  if (commentQueue.length > 0) flushQueue();
}
