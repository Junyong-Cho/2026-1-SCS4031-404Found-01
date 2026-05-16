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
const flushQueue = async () => {
  const settings = await chrome.storage.local.get(["serviceActive", "filterStep"]);

  // 서비스가 비활성화 상태이거나 전송할 댓글이 없으면 종료
  if (!settings.serviceActive || commentQueue.length === 0) return;

  // 큐에서 최대 15개까지만 잘라내기 (남은 건 다음 1.5초 주기에 처리)
  const chunk = commentQueue.splice(0, MAX_BATCH_SIZE);

  const stepMap = { 1: "blur", 2: "humor", 3: "refine" };
  const payload = {
    userSetting: stepMap[settings.filterStep] || "blur",
    comments: chunk.map((c) => ({
      id: String(c.id),
      text: String(c.text),
      detectedKeywords: c.detectedKeywords || [],
    })),
  };

  // --- [로그] 서버로 보내는 내용 확인 ---
  console.group(`[서버 전송] 총 ${chunk.length}개 댓글 발송`);
  console.log("전송 데이터(Payload):", payload);
  console.groupEnd();

  chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
    // --- [로그] 서버에서 온 내용 확인 ---
    if (chrome.runtime.lastError) {
      console.error("[통신 에러]", chrome.runtime.lastError.message);
      return;
    }

    console.group(`[서버 응답] 수신 완료`);
    console.log("받은 데이터(Response):", response);

    if (response?.results) {
      console.log(`성공적으로 ${response.results.length}개의 분석 결과를 가져왔습니다.`);
      renderCleanResults(response);
    } else {
      console.warn("서버 응답 형식이 올바르지 않거나 결과가 없습니다.");
    }
    console.groupEnd();
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
        applyBlurAndSkeleton(target, config);

        if (observationTimers.has(target)) {
          clearTimeout(observationTimers.get(target));
        }

        // 2. 0.8초 체류 확인 후 큐 삽입
        const timer = setTimeout(() => {
          if (processedIds.has(lcId)) return;

          const commentEl = querySelectorWithFallback(target, config.comment, "commentBody");
          if (commentEl) {
            const text = commentEl.innerText.trim();

            // 로컬 금지어 체크 로직
            const foundKeywords = personalKeywords.filter((kw) => text.includes(kw));

            commentQueue.push({
              id: lcId,
              text: text,
              detectedKeywords: foundKeywords,
            });
            processedIds.add(lcId);
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
  // 1. 서비스 토글 (ON/OFF)
  if (msg.action === "TOGGLE_SERVICE") {
    if (msg.active) {
      reprocessAllVisibleComments();
      initObservation();
    } else {
      restoreAllComments(getConfig());
    }
  }

  // 2. 우클릭 메뉴 등으로부터 온 토스트 알림
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
    console.log("[설정 변경] 금지어가 추가/삭제되었습니다. 캐시를 비우고 다시 분석합니다.");

    // 캐시와 처리된 ID 목록 초기화 (그래야 다시 요청함)
    cleanCache.clear();
    reprocessAllVisibleComments();
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
function reprocessAllVisibleComments() {
  const config = getConfig();
  processedIds.clear(); // 기존 처리 기록 초기화 (캐시는 유지하되 새로고침 시엔 clear 가능)

  document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
    const lcId = container.getAttribute("data-lc-id");

    // 캐시에 있다면 바로 렌더링
    if (cleanCache.has(lcId)) {
      renderCleanResult(cleanCache.get(lcId), container, config);
      return;
    }

    // 캐시에 없다면 큐에 삽입
    const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");
    if (commentEl && !processedIds.has(lcId)) {
      applyBlurAndSkeleton(container, config); // 로딩 표시
      commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
      processedIds.add(lcId);
    }
  });

  if (commentQueue.length > 0) flushQueue();
}
