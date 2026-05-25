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
    // 금지어가 제거되었을 경우 화면을 즉시 백업된 원본 데이터로 환원 유도
    const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
    if (commentSpan && container.dataset.originalText) {
      commentSpan.textContent = container.dataset.originalText;
    }
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
      const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
      if (commentSpan) commentSpan.textContent = originalText;
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
  if (!chrome || !chrome.runtime || !chrome.runtime.id) return;

  const settings = await chrome.storage.local.get(["serviceActive", "filterStep"]);
  if (!settings.serviceActive || commentQueue.length === 0) return;

  const chunk = commentQueue.splice(0, MAX_BATCH_SIZE);

  const payload = {
    comments: chunk.map((c) => ({
      id: String(c.id),
      text: String(c.text),
    })),
  };

  console.log("[댓글세탁소] 서버 전송 데이터 (Request Body)", JSON.stringify(payload, null, 2));

  chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
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

    if (response && response.results) {
      console.log("[댓글세탁소] 서버 응답 데이터 (Response Body)", JSON.stringify(response, null, 2));

      const currentStep = settings.filterStep ?? 1;

      const enrichedResponse = {
        ...response,
        results: response.results.map((item) => {
          try {
            const el = document.querySelector(`[data-lc-id="${item.id}"]`);
            if (el && el.dataset && el.dataset.localSanitizedText) {
              return {
                ...item,
                filterStep: currentStep,
                convertedText: String(el.dataset.localSanitizedText),
              };
            }
          } catch (e) {}

          return {
            ...item,
            filterStep: currentStep,
          };
        }),
      };

      if (typeof renderCleanResults === "function") {
        renderCleanResults(enrichedResponse);
      }
    }
  });
};

function initObservation() {
  const config = getConfig();
  if (!config) return;

  const newContainers = document.querySelectorAll(`${config.container}:not([data-observed])`);
  if (newContainers.length === 0) return;

  newContainers.forEach((container) => {
    const linkEl = querySelectorWithFallback(container, config.link, "commentLink");
    const lcId = extractLcId(linkEl?.getAttribute("href"));

    if (!linkEl || !lcId) {
      console.warn("[DOM 매핑 경고] 댓글 ID 추출 실패", { container, lcId });
      return;
    }

    container.setAttribute("data-lc-id", lcId);
    container.setAttribute("data-observed", "true");
    commentObserver.observe(container);
  });
}

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

        if (cleanCache.has(lcId)) {
          renderCleanResult(cleanCache.get(lcId), target, config);
          return;
        }

        // 현재 큐 버퍼 안에서 실시간으로 대기 중이라면 중복 등록 방지를 위해 탈출만 시킴 (블러 차단 금지)
        if (commentQueue.some((item) => item.id === lcId)) {
          return;
        }

        if (!shouldSkipBlur(target)) {
          applyBlurAndSkeleton(target, config);
        }

        if (observationTimers.has(target)) {
          clearTimeout(observationTimers.get(target));
        }

        const timer = setTimeout(() => {
          if (processedIds.has(lcId) && !cleanCache.has(lcId) && !commentQueue.some((item) => item.id === lcId)) {
            // 완전히 끝난 데이터가 아니라면 중복 추가 방지 가드 작동
            return;
          }

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
              const commentSpan = querySelectorWithFallback(target, config.commentSpan, "commentSpan");
              if (commentSpan) commentSpan.textContent = target.dataset.originalText || text;
            }

            // 안전성 재검증 후 큐 주입
            if (!commentQueue.some((item) => item.id === lcId)) {
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

const startService = async () => {
  const config = getConfig();
  if (!config || !config.container) {
    setTimeout(startService, 200);
    return;
  }

  const { serviceActive } = await chrome.storage.local.get("serviceActive");
  if (serviceActive) initObservation();

  const domObserver = new MutationObserver(initObservation);
  domObserver.observe(document.body, { childList: true, subtree: true });
};

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

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  const config = getConfig();

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

  if (changes.personalKeywords) {
    const oldKeywords = changes.personalKeywords.oldValue || [];
    const newKeywords = changes.personalKeywords.newValue || [];
    console.log("[설정 변경] 금지어가 추가/삭제되었습니다. 관련 댓글만 선별 재처리합니다.");

    reprocessCommentsForKeywordChange(config, oldKeywords, newKeywords);
  }
});

setInterval(flushQueue, 1500);
startService();

async function reprocessAllVisibleComments() {
  const config = getConfig();
  processedIds.clear();

  const { personalKeywords = [] } = await chrome.storage.local.get("personalKeywords");

  document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
    const lcId = container.getAttribute("data-lc-id");

    if (cleanCache.has(lcId)) {
      renderCleanResult(cleanCache.get(lcId), container, config);
      return;
    }

    const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");
    if (commentEl) {
      const rawText = commentEl.innerText.trim();
      queueComment(container, config, rawText, personalKeywords);
    }
  });

  if (commentQueue.length > 0) flushQueue();
}
