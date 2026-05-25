// src/popup/js/keywords.js
import { showToast } from "./utils.js";

/**
 * 현재 화면에 표시된 태그들을 기반으로 personalKeywords 크롬 스토리지를 업데이트합니다.
 * @param {HTMLElement} container - 태그들이 담겨있는 부모 컨테이너 (#keyword-tags)
 */
export function saveKeywords(container) {
  const tags = container.querySelectorAll(".tag");
  const keywords = Array.from(tags).map((tag) => {
    // ✕ 버튼 텍스트를 제외하고 순수 키워드 텍스트만 추출
    return tag.firstChild.textContent.trim();
  });

  chrome.storage.local.set({ personalKeywords: keywords }, () => {
    console.log("[스토리지 업데이트] 개인 키워드:", keywords);
  });
}

/**
 * 화면에 키워드 태그 UI를 동적으로 생성하고 삭제 이벤트를 바인딩합니다.
 * @param {string} keyword - 추가할 단어
 * @param {HTMLElement} container - 태그를 삽입할 부모 컨테이너 (#keyword-tags)
 */
export function addTag(keyword, container) {
  // 1. 태그 기본 엘리먼트 생성
  const tag = document.createElement("span");
  tag.className = "tag";
  const textNode = document.createTextNode(keyword);
  tag.appendChild(textNode);

  // 2. 삭제 버튼(✕) 생성
  const deleteBtn = document.createElement("button");
  deleteBtn.innerText = "✕";
  deleteBtn.style.marginLeft = "6px";
  deleteBtn.style.cursor = "pointer";
  deleteBtn.style.border = "none";
  deleteBtn.style.background = "none";
  deleteBtn.style.color = "inherit";

  // 3. 삭제 버튼 클릭 핸들러 바인딩 (서버와 동기화 및 락 연동)
  deleteBtn.addEventListener("click", () => {
    const addKeywordBtn = document.getElementById("add-keyword");

    if (addKeywordBtn) {
      addKeywordBtn.disabled = true;
      addKeywordBtn.style.opacity = "0.5";
    }
    container.style.opacity = "0.5";
    container.style.pointerEvents = "none"; // 삭제 광클을 방지하기 위해 물리적 클릭 차단

    // 백그라운드 서버로 해당 유저의 금지어 삭제 요청 전송
    chrome.runtime.sendMessage(
      {
        type: "DELETE_SERVER_KEYWORD",
        keyword: keyword,
      },
      (response) => {
        if (addKeywordBtn) {
          addKeywordBtn.disabled = false;
          addKeywordBtn.style.opacity = "1";
        }
        container.style.opacity = "1";
        container.style.pointerEvents = "auto"; // 다시 클릭 가능하도록 잠금 해제

        if (response?.status === "success") {
          tag.remove();
          saveKeywords(container);
          showToast(`'${keyword}' 단어가 삭제되었습니다.`);

          chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url?.includes("youtube.com")) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_SERVICE", active: true });
            }
          });
        } else {
          showToast("서버에서 키워드를 삭제하는 데 실패했습니다.");
        }
      },
    );
  });

  // 4. 구조 조립 및 컨테이너 삽입
  tag.appendChild(deleteBtn);
  container.appendChild(tag);
}
