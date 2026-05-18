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
    tag.remove();
    saveKeywords(container);
  });

  tag.appendChild(deleteBtn);
  container.appendChild(tag);
}
