// src/content/injector.js
import {
  getConfig,
  extractLcId,
  applyBlurAndSkeleton,
  renderCleanResultFromServer,
  renderCleanResult,
  restoreAllComments,
  cleanCache,
  querySelectorWithFallback,
  updateLaundryStats,
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

const MAX_RETRY = 2; // 최초 요청 포함 총 3번 (재시도 2번)
const REQUEST_TIMEOUT_MS = 20000; // 20초 타임아웃

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePersonalKeywords(text, personalKeywords) {
  const sanitizedText = personalKeywords?.reduce((currentText, keyword) => {
    if (!keyword) return currentText;
    const regex = new RegExp(escapeRegExp(keyword), "g");
    return currentText.replace(regex, "아잉❤️");
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

/**
 * 서버 전송용 텍스트 생성: 원본 텍스트에서 금지어를 아잉❤️로 치환한 텍스트
 */
function buildServerText(rawText, personalKeywords) {
  if (!personalKeywords || personalKeywords.length === 0) return rawText;
  return personalKeywords.reduce((currentText, keyword) => {
    if (!keyword) return currentText;
    const regex = new RegExp(escapeRegExp(keyword), "g");
    return currentText.replace(regex, "아잉❤️");
  }, rawText);
}

function queueComment(container, config, rawText, personalKeywords, isPriority = false) {
  const lcId = container.getAttribute("data-lc-id");
  if (!lcId || !rawText) return;

  if (!container.dataset.originalText) {
    container.dataset.originalText = rawText;
  }

  const { foundKeywords } = replacePersonalKeywords(rawText, personalKeywords);
  if (foundKeywords.length > 0) {
    container.dataset.localSanitizedText = buildServerText(rawText, personalKeywords);
  } else {
    delete container.dataset.localSanitizedText;
  }

  if (!processedIds.has(lcId)) {
    if (!shouldSkipBlur(container)) {
      applyBlurAndSkeleton(container, config);
    }

    const serverText = buildServerText(rawText, personalKeywords);

    if (isPriority) {
      commentQueue.unshift({ id: lcId, text: serverText, _retryCount: 0 });
    } else {
      commentQueue.push({ id: lcId, text: serverText, _retryCount: 0 });
    }
    processedIds.add(lcId);

    // 큐에 넣는 즉시 비동기로 전송 처리 시작
    sendNext();
  }
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

    const { foundKeywords } = replacePersonalKeywords(originalText, newKeywords);
    if (foundKeywords.length > 0) {
      container.dataset.localSanitizedText = buildServerText(originalText, newKeywords);
    } else {
      delete container.dataset.localSanitizedText;
    }

    if (cleanCache.has(lcId)) {
      const cached = cleanCache.get(lcId);
      delete container.dataset.userRevealed;
      renderCleanResult(cached, container, config);
      return;
    }

    processedIds.delete(lcId);
    delete container.dataset.userRevealed;

    if (!shouldSkipBlur(container)) {
      applyBlurAndSkeleton(container, config);
    }

    const serverText = buildServerText(originalText, newKeywords);
    commentQueue.unshift({ id: lcId, text: serverText, _retryCount: 0 });
    processedIds.add(lcId);
  });

  sendNext();
}

/**
 * [동시 전송] 큐에 쌓인 항목들을 기다리지 않고 한 번에 모두 전송
 */
function sendNext() {
  if (commentQueue.length === 0) return;

  chrome.storage.local.get("serviceActive", (settings) => {
    if (!settings.serviceActive || commentQueue.length === 0) {
      return;
    }

    const currentBatch = [...commentQueue];
    commentQueue = [];

    currentBatch.forEach((item) => {
      const attemptNumber = (item._retryCount || 0) + 1;
      const totalAttempts = MAX_RETRY + 1;

      const payload = {
        id: String(item.id),
        text: String(item.text),
      };

      console.log(`[댓글세탁소] [동시 전송] 서버 전송 (${attemptNumber}/${totalAttempts}) id=${item.id}`);

      let isSettled = false;

      const timeoutId = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;

        console.warn(`[댓글세탁소] 응답 타임아웃 (${attemptNumber}/${totalAttempts}) id=${item.id}`);

        if (attemptNumber < totalAttempts) {
          commentQueue.push({ ...item, _retryCount: attemptNumber });
          sendNext();
        }
      }, REQUEST_TIMEOUT_MS);

      chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError || !response || response.error) {
          console.error(
            `[댓글세탁소] 전송 실패 (${attemptNumber}/${totalAttempts}) id=${item.id}`,
            chrome.runtime.lastError || response?.error,
          );

          if (attemptNumber < totalAttempts) {
            commentQueue.push({ ...item, _retryCount: attemptNumber });
            sendNext();
          }
          return;
        }

        if (response && response.id !== undefined) {
          console.log(`[댓글세탁소] 서버 응답 완료 id=${response.id}`);

          updateLaundryStats(response.id, response.isToxic);

          if (typeof renderCleanResultFromServer === "function") {
            renderCleanResultFromServer(response);
          }
        }
      });
    });
  });
}

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

        if (commentQueue.some((item) => item.id === lcId)) {
          return;
        }

        if (!shouldSkipBlur(target)) {
          applyBlurAndSkeleton(target, config);
        }

        if (observationTimers.has(target)) {
          clearTimeout(observationTimers.get(target));
        }

        // 800ms 디바운스 대기 후 전송 절차 진행
        const timer = setTimeout(() => {
          if (processedIds.has(lcId) && !cleanCache.has(lcId) && !commentQueue.some((item) => item.id === lcId)) {
            return;
          }

          const commentEl = querySelectorWithFallback(target, config.comment, "commentBody");
          if (commentEl) {
            const rawText = commentEl.innerText.trim();

            if (!target.dataset.originalText) {
              target.dataset.originalText = rawText;
            }

            const { foundKeywords } = replacePersonalKeywords(rawText, personalKeywords);
            if (foundKeywords.length > 0) {
              target.dataset.localSanitizedText = buildServerText(rawText, personalKeywords);
            } else {
              if (target && target.dataset) {
                delete target.dataset.localSanitizedText;
              }
              const commentSpan = querySelectorWithFallback(target, config.commentSpan, "commentSpan");
              if (commentSpan) commentSpan.textContent = target.dataset.originalText || rawText;
            }

            if (!commentQueue.some((item) => item.id === lcId)) {
              if (!shouldSkipBlur(target)) {
                applyBlurAndSkeleton(target, config);
              }

              const serverText = buildServerText(rawText, personalKeywords);
              commentQueue.unshift({
                id: lcId,
                text: serverText,
                _retryCount: 0,
              });
              processedIds.add(lcId);
            }
            observationTimers.delete(target);

            sendNext();
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
      queueComment(container, config, rawText, personalKeywords, true);
    }
  });
}
