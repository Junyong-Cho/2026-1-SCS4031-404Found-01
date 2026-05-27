/**
 * 커스텀 의견 보내기 모달을 생성하고 표시하는 함수
 */
export function showFeedbackModal(commentId, plainText, convertedText) {
  if (document.querySelector(".laundry-modal-overlay")) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "laundry-modal-overlay";

  // 중복 선택할 태그 리스트 배열
  const tags = [
    "오탐지",
    "순화가 어색함",
    "의미가 바뀜",
    "너무 과하게 정화됨",
    "정화가 부족함",
    "문맥 이해 실패",
    "기타",
  ];

  // 태그 HTML 동적 생성
  const tagsHtml = tags.map((tag) => `<span class="feedback-tag">${tag}</span>`).join("");

  modalOverlay.innerHTML = `
    <div class="laundry-modal-content">
      <div class="laundry-modal-header">
        <h3>의견 보내기</h3>
        <button class="modal-close-x">&times;</button>
      </div>
      <p class="modal-desc">정화 결과가 부적절한가요? 해당되는 항목을 선택해주세요.</p>
      
      <div class="feedback-tags-container">${tagsHtml}</div>
      
      <textarea id="feedback-text" placeholder="상세한 의견이 있다면 적어주세요 (선택)"></textarea>
      
      <div class="laundry-modal-buttons">
        <button class="modal-cancel">취소</button>
        <button class="modal-submit">보내기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const tagElements = modalOverlay.querySelectorAll(".feedback-tag");
  tagElements.forEach((tagEl) => {
    tagEl.onclick = () => {
      tagEl.classList.toggle("active");
    };
  });

  // 이벤트: 취소 및 닫기
  const closeModal = () => modalOverlay.remove();
  modalOverlay.querySelector(".modal-cancel").onclick = closeModal;
  modalOverlay.querySelector(".modal-close-x").onclick = closeModal;

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  modalOverlay.querySelector(".modal-submit").onclick = async () => {
    const selectedTags = Array.from(modalOverlay.querySelectorAll(".feedback-tag.active")).map((el) => el.textContent);
    const additionalReason = modalOverlay.querySelector("#feedback-text").value.trim();

    if (selectedTags.length === 0 && !additionalReason) {
      alert("항목을 선택하거나 내용을 입력해주세요.");
      return;
    }

    const { isLoggedIn, serverToken } = await chrome.storage.local.get(["isLoggedIn", "serverToken"]);

    if (!isLoggedIn || !serverToken) {
      alert("로그인이 필요한 기능입니다. 확장 프로그램 팝업에서 로그인을 진행해 주세요.");
      return;
    }

    // 서버로 날릴 최종 데이터
    const finalFeedback = {
      tags: selectedTags,
      reason: additionalReason,
      plainText: plainText,
      convertedText: convertedText,
    };

    sendFeedbackToServer(commentId, finalFeedback, (response) => {
      modalOverlay.remove();

      if (response && response.status === "success") {
        alert("의견이 성공적으로 접수되었습니다. 감사합니다!");
      } else if (response && response.error && response.error.includes("401")) {
        alert(
          "로그인이 필요하거나 세션이 만료되었습니다.\n우측 상단의 댓글세탁소 팝업을 열어 로그인을 진행해 주세요! 🧼",
        );
      } else {
        alert("서버 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };
}

/**
 * 서버로 피드백 데이터를 전송하는 내부 함수
 */
function sendFeedbackToServer(commentId, feedbackData, callback) {
  try {
    chrome.runtime.sendMessage(
      {
        type: "SEND_FEEDBACK",
        data: {
          id: null,
          tags: feedbackData.tags,
          reason: feedbackData.reason,
          videoUrl: window.location.href,
          plainText: feedbackData.plainText,
          convertedText: feedbackData.convertedText,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[댓글세탁소] 런타임 메시지 전송 에러:", chrome.runtime.lastError.message);
          if (typeof callback === "function") {
            callback({ status: "error", error: chrome.runtime.lastError.message });
          }
          return;
        }

        if (typeof callback === "function") {
          callback(response);
        }
      },
    );
  } catch (e) {
    console.warn("sendFeedbackToServer failed:", e);
    if (typeof callback === "function") {
      callback({ status: "error", error: e.message });
    }
  }
}
