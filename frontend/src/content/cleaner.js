// src/content/cleaner.js
import { showFeedbackModal } from "./feedback/feedback.js";

/**
 * 정화된 댓글 데이터를 메모리에 임시 저장하는 캐시 맵
 * 동일한 페이지 내에서 중복 처리를 방지하기 위해 사용
 */
export const cleanCache = new Map();

/**
 * 유튜브 DOM 선택자 설정
 */
export const YOUTUBE_CONFIG = {
  container: "ytd-comment-view-model",
  comment: ["#content-text", "yt-formatted-string#content-text"],
  commentSpan: ["#content-text span.ytAttributedStringHost", "#content-text span"],
  avatarWrapper: ["#author-thumbnail yt-img-shadow", "#author-thumbnail img"],
  link: ["#published-time-text a", "#header-author a"],
};

export function getConfig() {
  return YOUTUBE_CONFIG;
}

export function resolveSelectors(selectors) {
  return Array.isArray(selectors) ? selectors : [selectors];
}

export function querySelectorWithFallback(root, selectors, name = "unknown") {
  const selectorList = resolveSelectors(selectors);
  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) {
      if (selectorList.length > 1) {
        console.debug(`[DOM 매핑] ${name} 선택자 매칭됨: ${selector}`);
      }
      return element;
    }
  }

  console.warn(`[DOM 매핑 오류] ${name} 요소를 찾지 못했습니다. 시도한 선택자: ${selectorList.join(" | ")}`, root);
  return null;
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
  const commentBody = querySelectorWithFallback(containerEl, config.comment, "commentBody");
  const lcId = containerEl.getAttribute("data-lc-id");
  console.log(`[스켈레톤 적용 시도] ID: ${lcId}`);

  // 이미 정화된 이력이 캐시에 있다면 즉시 렌더링하고 종료
  if (cleanCache.has(lcId)) {
    console.log(`[캐시 히트] 이미 정화된 댓글입니다. 즉시 렌더링: ${lcId}`);
    renderCleanResult(cleanCache.get(lcId), containerEl, config);
    return;
  }

  // 초기 상태: 댓글 본문 블러 처리
  if (commentBody) {
    commentBody.classList.add("comment-seeding-blur");
    console.log("[블러 적용 완료]");
  } else {
    console.warn(`[DOM 매핑 경고] 댓글 본문을 찾을 수 없어 블러를 적용하지 않습니다. ID: ${lcId}`);
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
  const commentBody = querySelectorWithFallback(container, config.comment, "commentBody");
  const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
  const skeleton = container.querySelector(".laundry-loading-skeleton");

  // 응답이 왔으므로 스켈레톤 UI 제거
  if (skeleton) skeleton.remove();

  // 원본 텍스트 최초 1회 저장
  if (!container.dataset.originalText && commentSpan) {
    container.dataset.originalText = commentSpan.textContent;
  }

  // 매 렌더링 전 배지 초기화 (단계 변경 시 이전 배지 제거)
  const existingBadge = container.querySelector(".laundry-clean-badge");
  if (existingBadge) existingBadge.remove();

  if (!commentBody || !commentSpan) {
    console.warn(
      `[DOM 매핑 오류] renderCleanResult에 필요한 댓글 요소를 찾을 수 없습니다. result.id=${result.id}, container=`,
      container,
    );
    return;
  }

  if (result.isToxic) {
    injectFeedbackButton(container, result); // 피드백 버튼 주입
    // 2단계(Humor) 또는 3단계(Refined)인 경우 텍스트 교체 및 배지 삽입
    if (result.convertedText && (result.filterStep === "2" || result.filterStep === "3")) {
      commentSpan.textContent = result.convertedText; // 순화된 텍스트로 교체
      commentBody.classList.remove("comment-seeding-blur"); // 블러 해제
      commentBody.classList.remove("comment-seeding-blur");
      injectCleanBadge(container, config); // 아바타에 주황색 점 표시
    } else if (result.filterStep === "1") {
      commentSpan.textContent = container.dataset.originalText;
      setupBlurUI(commentBody);
    }
  } else {
    commentSpan.textContent = container.dataset.originalText;
    commentBody.classList.remove("comment-seeding-blur");
  }
}

// 일반모드 복원 함수
export function restoreAllComments(config) {
  document.querySelectorAll("[data-lc-id]").forEach((container) => {
    const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
    const commentBody = querySelectorWithFallback(container, config.comment, "commentBody");
    const badge = container.querySelector(".laundry-clean-badge");
    const skeleton = container.querySelector(".laundry-loading-skeleton");

    if (skeleton) skeleton.remove();
    if (badge) badge.remove();
    if (commentBody) commentBody.classList.remove("comment-seeding-blur");

    // 원본 텍스트 복원
    if (commentSpan && container.dataset.originalText) {
      commentSpan.textContent = container.dataset.originalText;
    }
  });
}

/**
 * 의견 보내기 버튼을 생성하고 주입하는 함수
 */
function injectFeedbackButton(container, result) {
  // 중복 생성 방지
  if (container.querySelector(".laundry-feedback-btn")) return;

  const toolbar = querySelectorWithFallback(container, "#toolbar", "toolbar");
  if (!toolbar) {
    console.warn(`[DOM 매핑 경고] 피드백 버튼을 삽입할 toolbar 요소를 찾을 수 없습니다. id=${result.id}`);
    return;
  }

  const feedbackBtn = document.createElement("button");
  feedbackBtn.className = "laundry-feedback-btn";
  feedbackBtn.innerText = "의견 보내기";
  feedbackBtn.title = "정화 결과가 부적절한가요?";

  // 클릭 이벤트: 피드백 폼 열기 또는 서버 전송
  feedbackBtn.onclick = () => {
    showFeedbackModal(result.id);
  };

  toolbar.appendChild(feedbackBtn);
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

  const authorThumbnail = container.querySelector("#author-thumbnail");
  if (!authorThumbnail) return;

  authorThumbnail.style.position = "relative";

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
    zIndex: "9999",
    pointerEvents: "none",
    display: "block",
  });
  authorThumbnail.appendChild(badge);
}
/**
 * 1단계(Blur) 처리된 댓글에 클릭 이벤트 리스너를 추가하여 클릭 시 내용을 볼 수 있게 함
 */
export function setupBlurUI(element) {
  element.classList.add("comment-seeding-blur");
  element.style.cursor = "pointer";
  element.title = "클릭하여 원본 보기";
  element.onclick = (e) => {
    e.preventDefault();
    element.classList.remove("comment-seeding-blur");
    element.onclick = null;
    element.style.cursor = "";
    element.title = "";
  };
}

/**
 * 정화 통계 데이터를 세션 스토리지에 업데이트하고 팝업 UI에 실시간 알림 전송
 * @param {Object} stats - 서버에서 전달받은 통계 데이터 ({totalScanned, toxicCount})
 */
export function updateLaundryStats(stats) {
  chrome.storage.session.get(["totalComments", "toxicComments"], (res) => {
    const newTotal = (res.totalComments || 0) + (stats.totalScanned || 0);
    const newToxic = (res.toxicComments || 0) + (stats.toxicCount || 0);

    chrome.storage.session.set({ totalComments: newTotal, toxicComments: newToxic }, () => {
      // 팝업 창에 현재 세션 통계 전송 (팝업이 열려 있을 경우 즉시 반영)
      chrome.runtime.sendMessage({ action: "UPDATE_STATS", totalComments: newTotal, toxicComments: newToxic }, () => {
        if (chrome.runtime.lastError) {
          // 팝업이 닫혀 있을 때 발생하는 에러를 조용히 처리
        }
      });
    });
  });
}
