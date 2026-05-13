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
    comments: chunk.map((c) => ({ id: String(c.id), text: String(c.text) })),
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
        // --- 1단계: 감지 즉시 블러 처리 ---
        // 이미 처리된 ID가 아니고, 아직 분석 결과가 없는 경우에만 즉시 블러
        if (!processedIds.has(lcId) && !cleanCache.has(lcId)) {
          const commentEl = querySelectorWithFallback(target, config.comment, "commentBody");
          if (commentEl) {
            commentEl.classList.add("comment-seeding-blur"); // 즉시 가리기
          }
        }

        // --- 2단계: 0.8초 체류 확인 후 서버 전송용 큐에 삽입 ---
        const timer = setTimeout(async () => {
          const { serviceActive } = await chrome.storage.local.get("serviceActive");
          if (!serviceActive || processedIds.has(lcId)) return;

          const commentEl = querySelectorWithFallback(target, config.comment, "commentBody");
          if (commentEl) {
            applyBlurAndSkeleton(target, config); // 스켈레톤 UI 적용
            commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
            processedIds.add(lcId);
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
          const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");
          if (commentEl) {
            applyBlurAndSkeleton(container, config);
            commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
            processedIds.add(lcId);
          } else {
            console.warn(`[DOM 매핑 경고] 전환 시 댓글 본문을 찾을 수 없습니다. lcId=${lcId}`);
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
    processedIds.clear();

    // 현재 화면에 보이는 댓글들을 다시 정화 프로세스에 태움
    document.querySelectorAll(`${config.container}[data-lc-id]`).forEach((container) => {
      const lcId = container.getAttribute("data-lc-id");
      const commentEl = querySelectorWithFallback(container, config.comment, "commentBody");

      if (commentEl) {
        applyBlurAndSkeleton(container, config); // 다시 로딩 표시
        commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
        processedIds.add(lcId);
      }
    });

    // 큐에 넣었으니 즉시 전송 시도
    flushQueue();
  }
});

// 1.5초 주기로 서버 전송
setInterval(flushQueue, 1500);

// 즉시 실행
startService();
