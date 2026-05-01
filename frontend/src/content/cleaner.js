// src/content/cleaner.js

/**
 * 정화된 댓글 데이터를 메모리에 임시 저장하는 캐시 맵
 * 동일한 페이지 내에서 중복 처리를 방지하기 위해 사용
 */
export const cleanCache = new Map();

/**
 * 유튜브 DOM 선택자 설정
 */
export const YOUTUBE_CONFIG = {
  container: "ytd-comment-view-model", // 댓글 전체 모델 (MutationObserver 타겟)
  comment: "#content-text", // 블러(Blur) 필터를 걸 타겟 요소
  commentSpan: "#content-text .ytAttributedStringHost", // 실제 텍스트가 들어있는 span
  avatarWrapper: "yt-img-shadow", // 정화 완료 배지(오렌지 점)를 붙일 위치
  link: "#published-time-text a", // lc(댓글 고유 ID) 파라미터가 포함된 링크
};

/**
 * 현재 접속한 유튜브 페이지의 레이아웃 타입을 판별하여 적절한 설정(Config) 반환
 */
export function getConfig() {
  return !!document.querySelector(YOUTUBE_CONFIG.desktop.container)
    ? YOUTUBE_CONFIG.desktop
    : YOUTUBE_CONFIG.responsive;
}

/**
 * 댓글 작성 시간 링크(href)에서 유튜브 댓글의 고유 식별자인 'lc' 값을 추출
 * @param {string} href - 댓글 작성 시간 요소의 링크 주소
 */
export function extractLcId(href) {
  if (!href) return null;

  try {
    const url = new URL(href, "https://www.youtube.com");
    let lc = url.searchParams.get("lc");

    // 파라미터로 못 찾을 경우를 대비한 정규식 처리
    if (!lc && href.includes("lc=")) {
      const match = href.match(/lc=([^&]+)/);
      lc = match ? match[1] : null;
    }

    return lc;
  } catch (e) {
    return null;
  }
}

/**
 * 서버 응답이 오기 전, 댓글에 기본 블러 처리와 '세탁 중' 스켈레톤 UI를 적용
 * @param {HTMLElement} containerEl - 댓글 컨테이너 요소
 * @param {Object} config - 현재 환경 설정 객체
 */
export function applyBlurAndSkeleton(containerEl, config) {
  const lcId = containerEl.getAttribute("data-lc-id");
  console.log(`[스켈레톤 적용 시도] ID: ${lcId}`);

  // 이미 정화된 이력이 캐시에 있다면 즉시 렌더링하고 종료
  if (cleanCache.has(lcId)) {
    console.log(`[캐시 히트] 이미 정화된 댓글입니다. 즉시 렌더링: ${lcId}`);
    renderCleanResult(cleanCache.get(lcId), containerEl, config);
    return;
  }

  // 초기 상태: 댓글 본문 블러 처리
  const commentBody = containerEl.querySelector(config.comment);
  if (commentBody) {
    commentBody.classList.add("comment-seeding-blur");
    console.log("[블러 적용 완료]");
  }

  // 중복 스켈레톤 생성 방지 및 '세탁 중' 안내 UI 삽입
  if (containerEl.querySelector(".laundry-loading-skeleton")) return;

  const skeletonEl = document.createElement("div");
  skeletonEl.className = "laundry-loading-skeleton";
  skeletonEl.innerHTML = `<div class="laundry-spinner"></div><span>세탁 중...</span>`;
  containerEl.appendChild(skeletonEl);
}

/**
 * 단일 댓글에 대해 서버로부터 받은 정화 결과(독성 여부, 순화 텍스트 등)를 실제 화면에 반영
 * @param {Object} result - 서버 응답 데이터 ({isToxic, convertedText, id, ...})
 * @param {HTMLElement} container - 해당 댓글 컨테이너
 * @param {Object} config - 설정 객체
 */
export function renderCleanResult(result, container, config) {
  const commentBody = container.querySelector(config.comment);
  const commentSpan = container.querySelector(config.commentSpan);
  const skeleton = container.querySelector(".laundry-loading-skeleton");

  // 응답이 왔으므로 스켈레톤 UI 제거
  if (skeleton) skeleton.remove();
  if (!commentBody || !commentSpan) return;

  if (result.isToxic) {
    // 2단계(Humor) 또는 3단계(Refined)인 경우 텍스트 교체 및 배지 삽입
    if (result.convertedText && (result.filterStep === "2" || result.filterStep === "3")) {
      commentSpan.textContent = result.convertedText; // 순화된 텍스트로 교체
      commentBody.classList.remove("comment-seeding-blur"); // 블러 해제
      injectCleanBadge(container, config); // 아바타에 주황색 점 표시
    } else {
      // 1단계(Blur)인 경우 클릭하면 내용이 보이는 UI 설정
      setupBlurUI(commentBody);
    }
  } else {
    // 악플이 아닌 경우 블러 제거
    commentBody.classList.remove("comment-seeding-blur");
  }
}

/**
 * 서버에서 넘어온 다수의 댓글 정화 결과 리스트를 순회하며 렌더링 지시
 * @param {Object} data - 서버 응답 전체 객체 ({results, stats})
 */
export async function renderCleanResults(data) {
  const { results, stats } = data;
  // 사용자 설정 단계(1, 2, 3)를 가져옴
  const { filterStep = "1" } = await chrome.storage.local.get("filterStep");
  const config = getConfig();

  results.forEach((result) => {
    result.filterStep = filterStep; // 렌더링 함수에서 참조할 수 있도록 데이터 추가
    cleanCache.set(result.id, result); // 캐시에 저장

    // data-lc-id 속성으로 미리 마킹해둔 DOM 요소를 찾아 렌더링
    const container = document.querySelector(`[data-lc-id="${result.id}"]`);
    if (!container) return;

    renderCleanResult(result, container, config);
  });

  // 통계 수치 업데이트
  if (stats) updateLaundryStats(stats);
}

/**
 * 정화된 댓글 작성자의 아바타 우측 상단에 오렌지색 '정화 완료' 배지(점) 삽입
 */
export function injectCleanBadge(container, config) {
  if (container.querySelector(".laundry-clean-badge")) return;

  const avatarWrapper = container.querySelector(config.avatarWrapper);
  if (!avatarWrapper) return;

  avatarWrapper.style.position = "relative";

  const badge = document.createElement("span");
  badge.className = "laundry-clean-badge";
  Object.assign(badge.style, {
    position: "absolute",
    top: "0",
    right: "0",
    width: "8px",
    height: "8px",
    backgroundColor: "orange",
    borderRadius: "50%",
    zIndex: "10",
    pointerEvents: "none",
  });
  avatarWrapper.appendChild(badge);
}

/**
 * 1단계(Blur) 처리된 댓글에 클릭 이벤트 리스너를 추가하여 클릭 시 내용을 볼 수 있게 함
 */
export function setupBlurUI(element) {
  element.classList.add("comment-seeding-blur");
  element.style.cursor = "pointer";
  element.onclick = (e) => {
    e.preventDefault();
    element.classList.remove("comment-seeding-blur");
    element.onclick = null; // 이벤트 1회성 소모
    element.style.cursor = "";
  };
}

/**
 * 누적 정화 통계 데이터를 로컬 스토리지에 업데이트하고 팝업 UI에 실시간 알림 전송
 * @param {Object} stats - 서버에서 전달받은 통계 데이터 ({totalScanned, sessionToxicCount})
 */
export function updateLaundryStats(stats) {
  chrome.storage.local.get(["totalComments", "toxicComments"], (res) => {
    const newTotal = (res.totalComments || 0) + (stats.totalScanned || 0);
    const newToxic = (res.toxicComments || 0) + (stats.sessionToxicCount || 0);

    chrome.storage.local.set({ totalComments: newTotal, toxicComments: newToxic }, () => {
      // 팝업 창에 현재 세션 통계 전송 (팝업이 열려 있을 경우 즉시 반영)
      chrome.runtime.sendMessage({ action: "UPDATE_STATS", totalComments: newTotal, toxicComments: newToxic }, () => {
        if (chrome.runtime.lastError) {
          // 팝업이 닫혀 있을 때 발생하는 에러를 조용히 처리
        }
      });
    });
  });
}
