// src/content/injector.js
import {
  cleanCache,
  getConfig,
  extractLcId,
  applyBlurAndSkeleton,
  renderCleanResults,
  updateLaundryStats,
} from "./cleaner.js";

console.log("댓글세탁소 injector loaded");

// ── 전역 상태 관리 ──────────────────────────────────────────────

/**
 * 서버로 전송하기 전 댓글 데이터를 일시적으로 보관하는 대기열
 * @type {Array<{id: string, text: string}>}
 */
let commentQueue = [];

/**
 * 중복 요청을 방지하기 위해 이미 처리 프로세스에 진입한 댓글 ID를 저장하는 집합
 * @type {Set<string>}
 */
const processedIds = new Set();

/**
 * 사용자의 시선 체류 시간을 측정하기 위해 각 댓글 요소별 타이머를 관리하는 맵
 * @type {Map<HTMLElement, number>}
 */
const observationTimers = new Map();

// ── 큐 관리 및 서버 통신 ──────────────────────────────────────────

/**
 * 큐에 쌓인 댓글들을 취합하여 백엔드 서버로 전송하고 결과를 받아 렌더링을 지시
 * @async
 * @returns {Promise<void>}
 */
const flushQueue = async () => {
  if (commentQueue.length === 0) return;

  // 1. 유저의 현재 정화 단계 설정 값 가져오기
  const { filterStep = "1" } = await chrome.storage.local.get("filterStep");
  const userSettingMap = { 1: "blur", 2: "humor", 3: "refine" };
  const currentSetting = userSettingMap[filterStep] || "blur";

  // 2. 서버가 기대하는 최종 데이터 구조(JSON) 생성
  const payload = {
    userSetting: currentSetting,
    comments: commentQueue.map((c) => ({
      id: String(c.id),
      text: String(c.text),
    })),
  };

  console.log("[최종 전송 구조]:", JSON.stringify(payload, null, 2));

  // 전송 시작과 동시에 큐를 비워 중복 전송 방지
  commentQueue = [];

  // Background Script로 데이터 전송 및 응답 수신
  chrome.runtime.sendMessage({ type: "PROCESS_COMMENTS", data: payload }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("통신 오류:", chrome.runtime.lastError.message);
      return;
    }

    if (response && response.results) {
      console.log("[서버 실제 응답 데이터]:", JSON.stringify(response, null, 2));
      renderCleanResults(response);
    } else {
      console.warn("⚠️ 서버에서 결과를 받았으나 results가 비어있음:", response);
    }
  });
};

// ── 관찰자 설정 (Intersection & Mutation) ──────────────────────────

/**
 * 댓글이 화면에 노출되는지 감지하고, 0.8초 이상 머물 경우에만 정화 큐에 추가
 * @type {IntersectionObserver}
 */
const commentObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const target = entry.target;
      const lcId = target.getAttribute("data-lc-id");

      if (entry.isIntersecting) {
        // 화면 노출 시 타이머 시작 (단순 스크롤 통과는 무시하기 위함)
        const timer = setTimeout(() => {
          const config = getConfig();
          if (lcId && !processedIds.has(lcId)) {
            const commentEl = target.querySelector(config.comment);
            if (commentEl) {
              console.log(`[실제 타겟 발견] 큐에 넣습니다: ${lcId}`);

              // 서버 응답 전 즉시 UI 처리 (블러 및 스켈레톤)
              applyBlurAndSkeleton(target, config);

              // 큐에 데이터 삽입 및 중복 처리 마킹
              commentQueue.push({ id: lcId, text: commentEl.innerText.trim() });
              processedIds.add(lcId);
            }
          }
        }, 800);
        observationTimers.set(target, timer);
      } else {
        // 화면에서 벗어나면 대기 중인 타이머 취소
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
 * 1.5초 간격으로 flushQueue를 실행하여 대기열의 댓글들을 배치 처리
 */
setInterval(flushQueue, 1500);

/**
 * 유튜브의 동적 로딩된 댓글 요소들을 찾아 고유 ID를 부여하고 관찰 대상에 등록
 * @returns {void}
 */
function initObservation() {
  const config = getConfig();
  const selector = `${config.container}:not([data-observed])`;
  const newContainers = document.querySelectorAll(selector);

  newContainers.forEach((container) => {
    const linkEl = container.querySelector(config.link);
    const lcId = extractLcId(linkEl?.getAttribute("href"));

    if (lcId) {
      // DOM 요소에 메타데이터 마킹
      container.setAttribute("data-lc-id", lcId);
      container.setAttribute("data-observed", "true");

      // 시각적 노출 여부 관찰 시작
      commentObserver.observe(container);
    }
  });
}

/**
 * 페이지 내 DOM 변화를 감시하여 새로운 댓글이 추가될 때마다 초기화 로직 수행
 * @type {MutationObserver}
 */
const domObserver = new MutationObserver(initObservation);
domObserver.observe(document.body, { childList: true, subtree: true });

// 스크립트 로드 시 즉시 1회 실행
initObservation();
