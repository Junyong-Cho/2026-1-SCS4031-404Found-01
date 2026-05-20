// 키워드 저장
export function saveKeywords(container) {
  const tags = container.querySelectorAll(".tag");
  const keywords = Array.from(tags).map((tag) => tag.childNodes[0].textContent.trim());
  chrome.storage.local.set({ personalKeywords: keywords });
}

// 태그 UI 생성
export function addTag(keyword, container) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.innerText = keyword;

  const deleteBtn = document.createElement("button");
  deleteBtn.innerText = "✕";

  deleteBtn.addEventListener("click", () => {
    // 삭제 버튼 누를 때 백그라운드 서버로 금지어 삭제 요청
    chrome.runtime.sendMessage(
      {
        type: "DELETE_SERVER_KEYWORD",
        keyword: keyword,
      },
      (response) => {
        if (response?.status === "success") {
          // 서버에서 성공적으로 삭제가 떨어지면 화면과 로컬 저장소에서 지움
          tag.remove();
          saveKeywords(container);
          showToast(`'${keyword}' 단어가 삭제되었습니다.`);
        } else {
          showToast("서버에서 키워드를 삭제하는 데 실패했습니다.");
        }
      },
    );
  });

  tag.appendChild(deleteBtn);
  container.appendChild(tag);
}
