// src/content/injector.js
import {
  getConfig,
  extractLcId,
  applyBlurAndSkeleton,
  renderCleanResults,
  renderCleanResult,
  restoreAllComments,
  cleanCache,
} from "./cleaner.js";
import "./injector.css";
import "./feedback/feedback.css";

let commentQueue = [];
const processedIds = new Set();
const observationTimers = new Map();

/**
 * [핵심] 큐 처리 로직 (설정에 따라 분기)
 */
const flushQueue = async () => {
  const settings = await chrome.storage.local.get(["serviceActive", "filterStep"]);
  if (!settings.serviceActive || commentQueue.length === 0) return;

  const stepMap = { 1: "blur", 2: "humor", 3: "refine" };
  const payload = {
    userSetting: stepMap[settings.filterStep] || "blur",
    comments: commentQueue.map((c) => ({ id: String(c.id), text: String(c.text) })),
  };

  commentQueue = [];

  console.log("[서버 전송 payload]", JSON.stringify(payload, null, 2));

  chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
    console.log("[서버 응답 raw]", response);
    if (chrome.runtime.lastError) {
      console.error("[sendMessage 에러]", chrome.runtime.lastError.message);
    }
    if (response?.results) renderCleanResults(response);
  });
};

/**
 * [핵심] 댓글 감지 및 데이터 추출
 */
function initObservation() {
  const config = getConfig();
  if (!config) return;

  const newContainers = document.querySelectorAll(`${config.container}:not([data-observed])`);

  newContainers.forEach((container) => {
    const linkEl = container.querySelector(config.link);
    const lcId = extractLcId(linkEl?.getAttribute("href"));

    if (lcId) {
      container.setAttribute("data-lc-id", lcId);
      container.setAttribute("data-observed", "true");
      commentObserver.observe(container); // 화면 노출 감지 시작
    }
  });
}

/**
 * [핵심] 화면 체류 감지 (0.8초)
 */
const commentObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const lcId = target.getAttribute("data-lc-id");

        const timer = setTimeout(async () => {
          const { serviceActive } = await chrome.storage.local.get("serviceActive");
          if (!serviceActive || processedIds.has(lcId)) return;

          const config = getConfig();
          const commentEl = target.querySelector(config.comment);
          if (commentEl) {
            applyBlurAndSkeleton(target, config); // 로딩 UI 적용
            commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
            processedIds.add(lcId);
          }
        }, 800);
        observationTimers.set(target, timer);
      } else {
        const timer = observationTimers.get(entry.target);
        if (timer) {
          clearTimeout(timer);
          observationTimers.delete(entry.target);
        }
      }
    });
  },
  { threshold: 0.1 },
);

/**
 * [시작점] 에러 방지용 안전 초기화
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

// TOGGLE_SERVICE 메시지 수신 핸들러
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "TOGGLE_SERVICE") {
    if (msg.active) {
      // 클린모드: 이미 본 댓글도 재처리 위해 초기화
      processedIds.clear();

      // 이미 화면에 보이는 댓글 즉시 처리
      const config = getConfig();
      document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
        const lcId = container.getAttribute("data-lc-id");

        if (cleanCache.has(lcId)) {
          // 캐시 있으면 API 재요청 없이 바로 렌더링
          const cached = cleanCache.get(lcId);
          renderCleanResult(cached, container, config);
        } else if (!processedIds.has(lcId)) {
          // 캐시 없는 것만 새로 요청
          const commentEl = container.querySelector(config.comment);
          if (commentEl) {
            applyBlurAndSkeleton(container, config);
            commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
            processedIds.add(lcId);
          }
        }
      });

      initObservation();
    } else {
      console.log("[일반모드 전환 - 복원 시작]");
      restoreAllComments(getConfig());
    }
  }
});

// 단계 변경 감지
chrome.storage.onChanged.addListener((changes) => {
  if (!changes.filterStep) return;

  const newStep = changes.filterStep.newValue;
  const config = getConfig();

  // 캐시에 있는 모든 댓글을 새 단계로 재렌더링
  document.querySelectorAll("[data-lc-id]").forEach((container) => {
    const lcId = container.getAttribute("data-lc-id");
    const cached = cleanCache.get(lcId);
    if (!cached) return;

    cached.filterStep = newStep; // 단계 업데이트
    renderCleanResult(cached, container, config);
  });
});

// 1.5초 주기로 서버 전송
setInterval(flushQueue, 1500);

// 즉시 실행
startService();
