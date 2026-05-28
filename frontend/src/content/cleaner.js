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
 */
export async function applyBlurAndSkeleton(containerEl, config) {
  try {
    const storage = await chrome.storage.local.get("serviceActive");
    const serviceActive = storage.serviceActive ?? false;

    if (!serviceActive) return;

    if (containerEl.dataset.userRevealed === "true") return;

    const lcId = containerEl.getAttribute("data-lc-id") || "no-id";

    if (cleanCache.has(lcId)) {
      renderCleanResult(cleanCache.get(lcId), containerEl, config);
      return;
    }

    const commentBody = querySelectorWithFallback(containerEl, config.comment, "commentBody");
    if (commentBody) {
      commentBody.classList.add("comment-seeding-blur");
    }

    if (containerEl.querySelector(".laundry-loading-skeleton")) return;

    const skeletonEl = document.createElement("div");
    skeletonEl.className = "laundry-loading-skeleton";
    skeletonEl.innerHTML = `
      <div class="laundry-spinner"></div>
      <span>세탁 중...</span>
    `;

    containerEl.appendChild(skeletonEl);
  } catch (err) {}
}

/**
 * 단일 댓글에 대해 서버로부터 받은 정화 결과를 실제 화면에 반영
 */
export async function renderCleanResult(result, container, config) {
  const commentBody = querySelectorWithFallback(container, config.comment, "commentBody");
  const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
  const skeleton = container.querySelector(".laundry-loading-skeleton");

  if (skeleton) skeleton.remove();

  // 원본 텍스트 최초 1회 안전하게 백업
  if (!container.dataset.originalText && commentSpan) {
    container.dataset.originalText = commentSpan.textContent;
  }

  const existingBadge = container.querySelector(".laundry-clean-badge");
  if (existingBadge) existingBadge.remove();

  if (!commentBody || !commentSpan) return;

  const storage = await chrome.storage.local.get(["personalKeywords", "filterStep"]);
  const personalKeywords = storage.personalKeywords || [];
  // filterStep은 result에 주입된 값 우선, 없으면 스토리지에서 읽음
  const filterStep = String(result.filterStep ?? storage.filterStep ?? "2");

  const originalText = container.dataset.originalText || commentSpan.textContent;

  // 금지어 포함 여부는 항상 원본 텍스트 기준으로 판단
  const hasKeyword = personalKeywords.some((keyword) => keyword && originalText.includes(keyword));

  // 순화 표시용 텍스트: 서버 convertedText 기반에 금지어 추가 치환
  const baseDisplayText = result.convertedText || originalText;
  const sanitizedDisplayText = hasKeyword
    ? personalKeywords.reduce((currentText, keyword) => {
        if (!keyword) return currentText;
        const regex = new RegExp(String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        return currentText.replace(regex, "아잉❤️");
      }, baseDisplayText)
    : baseDisplayText;

  const isTargetToHide = result.isToxic || hasKeyword;

  // =========================================================================
  // [정화 대상 분기] 서버인증 악플이거나, 내가 등록한 금지어가 들어간 경우
  // =========================================================================
  if (isTargetToHide) {
    // 서버가 악플로 판단한 경우에만 피드백 버튼 노출
    if (result.isToxic) {
      injectFeedbackButton(container, result);
    }

    if (filterStep === "1") {
      delete container.dataset.userRevealed;
    }

    if (filterStep === "2" || result.filterStep === "refine") {
      // [2단계 : 순화 모드] 블러 걷어내고 순화문 노출
      commentSpan.textContent = sanitizedDisplayText;
      commentBody.classList.remove("comment-seeding-blur");

      commentBody.onclick = null;
      commentBody.style.cursor = "";
      commentBody.title = "";

      injectCleanBadge(container, config);
      injectOriginalTextToggleBtn(container, commentSpan, originalText, sanitizedDisplayText);
    } else {
      // [1단계 : 블러 모드] 원본 텍스트 유지 + 블러 UI 적용
      // 블러 클릭 해제 시 원문(금지어 포함 원본)이 그대로 보여야 하므로 originalText 세팅
      commentSpan.textContent = originalText;
      const oldToggleBtn = container.querySelector(".laundry-toggle-orig-btn");
      if (oldToggleBtn) oldToggleBtn.remove();
      setupBlurUI(commentBody, container);
    }
  }
  // =========================================================================
  // [완전 청정 분기]
  // =========================================================================
  else {
    commentSpan.textContent = baseDisplayText;
    commentBody.classList.remove("comment-seeding-blur");

    commentBody.onclick = null;
    commentBody.style.cursor = "";
    commentBody.title = "";

    delete container.dataset.userRevealed;

    const existingFeedback = container.querySelector(".laundry-feedback-btn");
    if (existingFeedback) existingFeedback.remove();

    const oldToggleBtn = container.querySelector(".laundry-toggle-orig-btn");
    if (oldToggleBtn) oldToggleBtn.remove();
  }
}

// 일반모드 복원 함수
export function restoreAllComments(config) {
  document.querySelectorAll("[data-lc-id]").forEach((container) => {
    const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
    const commentBody = querySelectorWithFallback(container, config.comment, "commentBody");
    const badge = container.querySelector(".laundry-clean-badge");
    const skeleton = container.querySelector(".laundry-loading-skeleton");

    const toggleBtn = container.querySelector(".laundry-toggle-orig-btn");
    if (toggleBtn) toggleBtn.remove();

    if (skeleton) skeleton.remove();
    if (badge) badge.remove();
    if (commentBody) {
      commentBody.classList.remove("comment-seeding-blur");
      commentBody.onclick = null;
      commentBody.style.cursor = "";
      commentBody.title = "";
    }

    if (commentSpan && container.dataset.originalText) {
      commentSpan.textContent = container.dataset.originalText;
    }

    delete container.dataset.localSanitizedText;
    delete container.dataset.userRevealed;
  });
}

/**
 * 의견 보내기 버튼 주입
 */
function injectFeedbackButton(container, result) {
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

  feedbackBtn.onclick = () => {
    const plainText = container.dataset.originalText || "";
    const convertedText = result.convertedText || "";
    showFeedbackModal(result.id, plainText, convertedText);
  };

  toolbar.appendChild(feedbackBtn);
}

/**
 * 서버에서 넘어온 단일 댓글 정화 결과를 렌더링
 * @param {Object} data - 서버 응답 객체 ({id, isToxic, convertedText})
 */
export async function renderCleanResultFromServer(data) {
  const { filterStep } = await chrome.storage.local.get("filterStep");
  const config = getConfig();

  const result = {
    ...data,
    filterStep: String(filterStep ?? "2"),
  };

  cleanCache.set(result.id, result);

  const container = document.querySelector(`[data-lc-id="${result.id}"]`);
  if (!container) return;

  renderCleanResult(result, container, config);
}

/**
 * 정화된 댓글 아바타에 오렌지색 배지 삽입
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
 * 1단계(Blur) 처리: 클릭 시 원문(금지어 포함 원본) 노출
 */
export function setupBlurUI(element, container) {
  element.classList.add("comment-seeding-blur");
  element.style.cursor = "pointer";
  element.title = "클릭하여 원본 보기";
  element.onclick = (e) => {
    e.preventDefault();
    // 블러 해제 시 원문 복원 (commentSpan에 originalText 세팅)
    const config = getConfig();
    const commentSpan = querySelectorWithFallback(container, config.commentSpan, "commentSpan");
    if (commentSpan && container.dataset.originalText) {
      commentSpan.textContent = container.dataset.originalText;
    }
    element.classList.remove("comment-seeding-blur");
    element.onclick = null;
    element.style.cursor = "";
    element.title = "";
    if (container) {
      container.dataset.userRevealed = "true";
    }
  };
}

/**
 * 정화 통계 업데이트
 */
export function updateLaundryStats(stats) {
  chrome.runtime.sendMessage(
    {
      type: "UPDATE_LAUNDRY_STATS",
      stats: stats,
    },
    (response) => {
      if (chrome.runtime.lastError) {
      }
    },
  );
}

/**
 * 2단계 순화 모드: "원문 보기" 토글 버튼 주입
 */
function injectOriginalTextToggleBtn(container, commentSpan, originalText, displayText) {
  if (container.querySelector(".laundry-toggle-orig-btn")) return;

  const toolbar = querySelectorWithFallback(container, "#toolbar", "toolbar");
  if (!toolbar) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "laundry-toggle-orig-btn";
  toggleBtn.innerText = "원문 보기";
  toggleBtn.title = "순화 전 원래 댓글 보기";

  Object.assign(toggleBtn.style, {
    position: "static",
    background: "none",
    border: "none",
    color: "var(--yt-spec-text-primary, #0f0f0f)",
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "16px",
    cursor: "pointer",
    padding: "0 12px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Roboto", "Arial", sans-serif',
    borderRadius: "16px",
    transition: "background-color 0.1s ease, color 0.1s ease",
    marginLeft: "2px",
    marginRight: "2px",
    userSelect: "none",
  });

  toggleBtn.onmouseenter = () => {
    toggleBtn.style.backgroundColor = "#FFE2A3";
  };
  toggleBtn.onmouseleave = () => {
    toggleBtn.style.backgroundColor = "transparent";
  };

  let isShowingOriginal = false;
  toggleBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isShowingOriginal) {
      commentSpan.textContent = originalText;
      toggleBtn.innerText = "순화문 보기";
      toggleBtn.title = "정화된 순화문 보기";
      isShowingOriginal = true;
    } else {
      commentSpan.textContent = displayText;
      toggleBtn.innerText = "원문 보기";
      toggleBtn.title = "순화 전 원래 댓글 보기";
      isShowingOriginal = false;
    }
  };

  const replyBtnEnd = toolbar.querySelector("#reply-button-end");
  if (replyBtnEnd) {
    toolbar.insertBefore(toggleBtn, replyBtnEnd.nextSibling);
  } else {
    toolbar.appendChild(toggleBtn);
  }
}
