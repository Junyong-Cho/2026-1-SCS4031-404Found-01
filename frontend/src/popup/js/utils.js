import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

// 모드(일반/클린) 스타일 업데이트
export function updateModeUI(isCleanMode) {
  const modeGeneralLabel = document.getElementById("mode-general");
  const modeCleanLabel = document.getElementById("mode-clean");
  if (isCleanMode) {
    modeCleanLabel.classList.add("active");
    modeGeneralLabel.classList.remove("active");
  } else {
    modeGeneralLabel.classList.add("active");
    modeCleanLabel.classList.remove("active");
  }
}

// 통계 데이터 및 파이 차트 업데이트
export function updateStatisticsUI(total, toxic) {
  const totalElem = document.getElementById("total-count");
  const toxicElem = document.getElementById("toxic-count");
  const pieChart = document.querySelector(".pie-chart");
  const pieChartSpan = pieChart.querySelector("span");

  const percent = total > 0 ? ((toxic / total) * 100).toFixed(1) : 0;

  totalElem.innerText = total;
  toxicElem.innerText = toxic;
  toxicElem.nextSibling.textContent = ` (${percent}%)`;
  pieChartSpan.innerText = toxic;

  if (total === 0) {
    pieChart.style.background = "#e0dbd6";
  } else if (toxic == 0) {
    pieChart.style.background = `var(--chart-color)`;
  } else {
    pieChart.style.background = `conic-gradient(var(--primary-orange) 0deg ${percent * 3.6}deg, var(--chart-color) ${percent * 3.6}deg 360deg)`;
  }
}

// Toast 메시지
export function showToast(message) {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "center",
    stopOnFocus: true,
    style: {
      background: "linear-gradient(to right, #ff5f6d, #ffc371)",
      borderRadius: "10px",

      width: "auto",
      maxWidth: "70vw",
      display: "inline-block",
      whiteSpace: "nowrap",

      textAlign: "center",
      padding: "10px 20px",
    },
  }).showToast();
}
