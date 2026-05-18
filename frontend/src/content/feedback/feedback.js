/**
 * 커스텀 의견 보내기 모달을 생성하고 표시하는 함수
 */
export function showFeedbackModal(commentId) {
  // 중복 생성 방지
  if (document.querySelector(".laundry-modal-overlay")) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "laundry-modal-overlay";

  modalOverlay.innerHTML = `
    <div class="laundry-modal-content">
      <div class="laundry-modal-header">
        <h3>의견 보내기</h3>
        <button class="modal-close-x">&times;</button>
      </div>
      <p class="modal-desc">정화 결과가 부적절한가요? 의견을 남겨주세요.</p>
      <textarea id="feedback-text" placeholder="예: 오탐지입니다, 순화가 어색해요 등"></textarea>
      <div class="laundry-modal-buttons">
        <button class="modal-cancel">취소</button>
        <button class="modal-submit">보내기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // 이벤트: 취소 및 닫기
  const closeModal = () => modalOverlay.remove();
  modalOverlay.querySelector(".modal-cancel").onclick = closeModal;
  modalOverlay.querySelector(".modal-close-x").onclick = closeModal;

  // 배경 클릭 시 닫기
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  // 이벤트: 전송
  modalOverlay.querySelector(".modal-submit").onclick = () => {
    const reason = modalOverlay.querySelector("#feedback-text").value;
    if (reason.trim()) {
      sendFeedbackToServer(commentId, reason);
      modalOverlay.remove();
      alert("의견이 접수되었습니다. 감사합니다!");
    } else {
      alert("내용을 입력해주세요.");
    }
  };
}

// /**
//  * 서버로 피드백 데이터를 전송하는 내부 함수
//  */
// function sendFeedbackToServer(commentId, reason) {
//   chrome.runtime.sendMessage({
//     type: "SEND_FEEDBACK",
//     data: { id: commentId, reason: reason },
//   });
// }
