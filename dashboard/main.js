// dashboard/main.js

// 글로벌 데이터 저장소
let serverFeedbackList = [];
let serverTagDistribution = [];

// 필터 및 페이지네이션 제어 상태 변수
let currentStatusFilter = "전체";
let currentTagFilter = "전체";
let currentPage = 1;
let pageSize = 10;

// 백엔드 API 기본 주소 및 엔드포인트 정의
const BASE_URL = "https://404found-main-cwfvhyehgngaexds.koreacentral-01.azurewebsites.net";
const API_ENDPOINTS = {
  FEEDBACKS: `${BASE_URL}/report/feedbacks`,
  STAT_STATUS: `${BASE_URL}/report/stat/status`,
  STAT_TAGS: `${BASE_URL}/report/stat/tags`,
};

/**
 * 대시보드 초기화 함수
 */
async function initDashboard() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const firstDayOfMonth = todayStr.substring(0, 8) + "01";

  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");

  if (startDateInput) startDateInput.value = firstDayOfMonth;
  if (endDateInput) endDateInput.value = todayStr;

  await fetchAllDashboardData();
  setupEvents();
}

/**
 * 서버 API 통합 Fetch 함수
 */
async function fetchAllDashboardData() {
  try {
    // 1. 피드백 전체 리스트 및 태그 통계 병렬 조회
    const [feedbacksRes, tagsRes] = await Promise.all([
      fetch(API_ENDPOINTS.FEEDBACKS).catch((e) => ({ ok: false, status: "NET_ERROR" })),
      fetch(API_ENDPOINTS.STAT_TAGS).catch((e) => ({ ok: false, status: "NET_ERROR" })),
    ]);

    let rawFeedbacks = [];
    let rawTags = [];

    // 서버가 500 에러를 뱉거나 터졌다면, 에러를 내지 않고 빈 배열로 대체
    if (feedbacksRes.ok) {
      rawFeedbacks = await feedbacksRes.json();
    } else {
      console.warn(`[댓글세탁소] 피드백 리스트 조회 실패 (Status: ${feedbacksRes.status}). 빈 데이터로 대체합니다.`);
      rawFeedbacks = [];
    }

    if (tagsRes.ok) {
      rawTags = await tagsRes.json();
    } else {
      console.warn(`[댓글세탁소] 태그 통계 조회 실패 (Status: ${tagsRes.status}). 빈 데이터로 대체합니다.`);

      rawTags = [
        { tag: "오탐지", count: 0 },
        { tag: "순화가 어색함", count: 0 },
        { tag: "의미가 바뀜", count: 0 },
        { tag: "너무 과하게 정화됨", count: 0 },
        { tag: "문맥 이해 실패", count: 0 },
        { tag: "정화가 부족함", count: 0 },
        { tag: "기타", count: 0 },
      ];
    }

    // 2. 글로벌 변수에 데이터 매핑 및 가공
    const statusMap = {
      unverified: "미확인",
      verified: "확인완료",
    };

    serverFeedbackList = rawFeedbacks.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      videoUrl: item.videoUrl || "",
      originalText: item.plainText || "",
      cleanedText: item.convertedText || "",
      tags: item.tags || [],
      reason: item.feedback || "",
      status: statusMap[item.status] || "미확인",
    }));

    const tagColors = {
      오탐지: "#42a5f5",
      "순화가 어색함": "#66bb6a",
      "의미가 바뀜": "#ef5350",
      "너무 과하게 정화됨": "#ffca28",
      "문맥 이해 실패": "#ab47bc",
      "정화가 부족함": "#26a69a",
      기타: "#78909c",
    };

    const totalTagCount = rawTags.reduce((acc, cur) => acc + cur.count, 0) || 1;
    serverTagDistribution = rawTags.map((item) => ({
      tag: item.tag,
      count: item.count,
      percentage: totalTagCount > 1 ? Math.round((item.count / totalTagCount) * 100) : 0,
      color: tagColors[item.tag] || "#90a4ae",
    }));

    // 3. UI 갱신 및 차트 렌더링 리트리거
    updateSummaryCounters();
    renderTagDistributionList();
    render();
  } catch (error) {
    console.error("대시보드 치명적 렌더링 실패:", error);
    const tbody = document.getElementById("feedback-tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:red; font-weight:bold;">화면 초기화 중 에러가 발생했습니다.</td></tr>`;
    }
  }
}

/**
 * 요약 상단 카운터 숫자 실시간 연산 및 차트 도넛 그래디언트 주입 함수
 */
function updateSummaryCounters() {
  const total = serverFeedbackList.length;
  const unverified = serverFeedbackList.filter((i) => i.status === "미확인").length;
  const verified = serverFeedbackList.filter((i) => i.status === "확인완료").length;

  document.getElementById("total-count").textContent = total + "건";
  document.getElementById("unverified-count").textContent = unverified + "건";
  document.getElementById("verified-count").textContent = verified + "건";
  document.getElementById("chart-total").textContent = total;

  const safeTotal = total || 1;
  let accumulatedPercent = 0;

  const gradientParts = serverTagDistribution.map((item) => {
    const realPercent = Math.round((item.count / safeTotal) * 100);
    const start = accumulatedPercent;
    accumulatedPercent += realPercent;
    const end = accumulatedPercent;
    return `${item.color} ${start}% ${end}%`;
  });

  const chartElement = document.getElementById("dynamic-chart");
  if (chartElement) {
    chartElement.style.background =
      gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(", ")})` : "#eceff1"; // 데이터가 한 건도 없을 때의 기본 회색 처리
  }
}

/**
 * 우측 서브 패널 태그 분포 리스트 출력 함수
 */
function renderTagDistributionList() {
  const tagListContainer = document.getElementById("tag-distribution-list");
  if (!tagListContainer) return;

  tagListContainer.innerHTML = serverTagDistribution
    .map(
      (item) => `
    <li>
      <span class="tag-label-group">
        <i class="color-dot" style="background-color: ${item.color}"></i>
        ${item.tag}
      </span>
      <strong>${item.percentage}% (${item.count}건)</strong>
    </li>
  `,
    )
    .join("");
}

/**
 * 메인 데이터 테이블 필터링 / 정렬 / 페이지네이션 렌더링 함수
 */
function render() {
  const tbody = document.getElementById("feedback-tbody");
  const searchKeyword = document.getElementById("search-input").value.trim().toLowerCase();

  const startInput = document.getElementById("start-date").value;
  const endInput = document.getElementById("end-date").value;

  const startDate = startInput ? new Date(startInput + "T00:00:00") : new Date("2026-01-01");
  const endDate = endInput ? new Date(endInput + "T23:59:59") : new Date();

  // 1. 다중 필터 조립
  let filtered = serverFeedbackList.filter((item) => {
    const itemDate = new Date(item.createdAt);
    const matchDate = itemDate >= startDate && itemDate <= endDate;
    const matchStatus = currentStatusFilter === "전체" || item.status === currentStatusFilter;
    const matchTag = currentTagFilter === "전체" || item.tags.includes(currentTagFilter);
    const matchSearch =
      item.originalText.toLowerCase().includes(searchKeyword) ||
      item.cleanedText.toLowerCase().includes(searchKeyword) ||
      item.reason.toLowerCase().includes(searchKeyword);
    return matchDate && matchStatus && matchTag && matchSearch;
  });

  // 2. 정렬 처리
  const sortValue = document.getElementById("sort-select").value;
  if (sortValue === "latest") {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // 3. 페이지네이션 슬라이싱 연산
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * pageSize;

  // 4. DOM 바인딩 및 그리기
  const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

  if (pagedItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:gray;">조건에 부합하는 피드백 내역이 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = pagedItems
      .map((item, index) => {
        const tagsHtml = item.tags.map((t) => `<span class="table-tag">${t}</span>`).join(" ");
        let statusClass = "status-unverified";
        if (item.status === "확인완료") statusClass = "status-verified";

        const videoLinkHtml = item.videoUrl
          ? `<a href="${item.videoUrl}" target="_blank" rel="noopener noreferrer" class="video-link-btn" title="해당 영상으로 이동">🔗</a>`
          : `<span style="color:var(--text-muted); font-size:11px;">없음</span>`;
        const displayNo = startIdx + index + 1;

        return `
      <tr>
        <td>${displayNo}</td> 
        <td class="time-col">${formatDateTime(item.createdAt)}</td>
        <td>${videoLinkHtml}</td> 
        <td class="text-col" title="${item.originalText}">${item.originalText}</td>
        <td class="text-col" title="${item.cleanedText}">${item.cleanedText}</td>
        <td><div class="tag-flex">${tagsHtml}</div></td>
        <td class="reason-col" title="${item.reason}">${item.reason}</td>
        <td>
          <select class="status-dropdown ${statusClass}" onchange="changeStatus('${item.id}', this.value)">
            <option value="미확인" ${item.status === "미확인" ? "selected" : ""}>미확인</option>
            <option value="확인완료" ${item.status === "확인완료" ? "selected" : ""}>확인완료</option>
          </select>
        </td>
      </tr>
    `;
      })
      .join("");
  }

  renderPagination(totalPages);
}

/**
 * 하단 하부 페이지네이션 버튼 가공 매핑기
 */
function renderPagination(totalPages) {
  const container = document.getElementById("pagination-zone");
  let html = `<button class="page-arrow" ${currentPage === 1 ? "disabled" : ""} onclick="movePage(${currentPage - 1})">&lt;</button>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-num ${i === currentPage ? "active" : ""}" onclick="movePage(${i})">${i}</button>`;
  }

  html += `<button class="page-arrow" ${currentPage === totalPages ? "disabled" : ""} onclick="movePage(${currentPage + 1})">&gt;</button>`;
  container.innerHTML = html;
}

window.movePage = function (page) {
  currentPage = page;
  render();
};

/**
 * 상태 업데이트 전송 연동 단치
 */
window.changeStatus = function (id, newStatus) {
  const item = serverFeedbackList.find((f) => String(f.id) === String(id));
  if (item) {
    item.status = newStatus;
    updateSummaryCounters();
    render();
    console.log(`[댓글세탁소] ID: ${id} 피드백 상태가 '${newStatus}'(으)로 로컬 업데이트되었습니다.`);
  }
};

/**
 * ISO형식 날짜 표준 커스텀 변환 포맷터 유틸리티 함수
 */
function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * 이벤트 리스너 바인딩 총괄 제어구
 */
function setupEvents() {
  const tabs = document.querySelectorAll("#status-tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentStatusFilter = tab.getAttribute("data-status");
      currentPage = 1;
      render();
    });
  });

  const tagBtns = document.querySelectorAll("#tag-filters .tag-filter-btn");
  tagBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tagBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTagFilter = btn.getAttribute("data-tag");
      currentPage = 1;
      render();
    });
  });

  document.getElementById("search-input").addEventListener("input", () => {
    currentPage = 1;
    render();
  });
  document.getElementById("sort-select").addEventListener("change", () => {
    render();
  });
  document.getElementById("start-date").addEventListener("change", () => {
    currentPage = 1;
    render();
  });
  document.getElementById("end-date").addEventListener("change", () => {
    currentPage = 1;
    render();
  });
  document.getElementById("page-size-select").addEventListener("change", (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    render();
  });
}

// 최초 DOM 완성 시 대시보드 시동 트레이서 트리거 바인딩
document.addEventListener("DOMContentLoaded", initDashboard);
