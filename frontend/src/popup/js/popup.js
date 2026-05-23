// src/popup/js/popup.js

import { updateModeUI, updateStatisticsUI, showToast } from "./utils.js";
import { addTag, saveKeywords } from "./keywords.js";

/**
 * 팝업 창이 로드될 때 실행되는 메인 초기화 로직
 */
document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM 요소 선택 ---
  const stepRadios = document.querySelectorAll('input[name="filterStep"]'); // 1/2단계 라디오 버튼
  const mainToggle = document.getElementById("service-onoff"); // 전체 서비스 ON/OFF 토글
  const modeGeneralLabel = document.getElementById("mode-general"); // '일반' 모드 레이블
  const modeCleanLabel = document.getElementById("mode-clean"); // '클린' 모드 레이블
  const keywordInput = document.getElementById("keyword-input"); // 키워드 입력창
  const addKeywordBtn = document.getElementById("add-keyword"); // 키워드 추가 버튼
  const keywordTagsContainer = document.getElementById("keyword-tags"); // 추가된 키워드 태그가 담길 컨테이너
  const logoutBtn = document.getElementById("btn-logout"); // 로그아웃 버튼
  const userEmailElem = document.getElementById("user-email"); // 유저 이메일 표시 영역
  const userInfoBar = document.getElementById("user-info-bar"); // 유저 정보 표시 바

  // --- 1-1. DOM 매핑 테이블 (디버깅 및 구조 확인용) ---
  const DOM = {
    stepRadios,
    mainToggle,
    modeGeneralLabel,
    modeCleanLabel,
    keywordInput,
    addKeywordBtn,
    keywordTagsContainer,
    logoutBtn,
    userEmailElem,
    userInfoBar,
    filterSettings: document.querySelector(".filter-settings"),
    cleanModePrompt: document.querySelector(".clean-mode-prompt"),
    statisticsCard: document.querySelector(".statistics-card"),
    personalSettings: document.querySelector(".personal-settings"),
  };

  // --- 1-2. 공통 함수: 설정 변경 시 유튜브 실시간 동기화 신호 전송 ---
  function sendConfigChangeToYoutube() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url?.includes("youtube.com")) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "TOGGLE_SERVICE",
            active: mainToggle.checked, // 현재 메인 토글의 ON/OFF 상태를 함께 전송
          },
          (response) => {
            // 통신 예외 또는 무응답 방어용 처리
            void chrome.runtime.lastError;
          },
        );
      }
    });
  }

  // --- 2. 초기 데이터 로드 (저장소 분리 호출) ---

  // (A) 영구 저장 데이터 (local): 설정, 키워드, 로그인 정보
  chrome.storage.local.get(["filterStep", "serviceActive", "personalKeywords", "userEmail", "isLoggedIn"], (res) => {
    console.log("[팝업 로드] 스토리지 데이터 확인:", res);

    // (1) 정화 단계 라디오 복구
    const filterStep = res.filterStep;
    if (filterStep) {
      const targetRadio = document.querySelector(`input[value="${filterStep}"]`);
      if (targetRadio) targetRadio.checked = true;
    }

    // (2) 서비스 활성화 상태 복구
    mainToggle.checked = res.serviceActive ?? false;
    updateModeUI(mainToggle.checked, DOM);

    // (3) 로그인 상태 UI 처리
    if (res.isLoggedIn) {
      userInfoBar.style.display = "flex";
      userEmailElem.innerText = res.userEmail || "";
      keywordInput.placeholder = "차단할 단어 입력";
    } else {
      userInfoBar.style.display = "none";
      keywordInput.placeholder = "클릭하여 로그인 후 이용";
    }

    // (4) 개인 차단 키워드 태그 생성
    if (res.personalKeywords) {
      keywordTagsContainer.innerHTML = "";
      res.personalKeywords.forEach((k) => addTag(k, keywordTagsContainer));
    }

    // (B) 휘발성 데이터 (session): 실시간 정화 통계
    chrome.storage.session.get(["totalComments", "toxicComments"], (sessionRes) => {
      updateStatisticsUI(sessionRes.totalComments || 0, sessionRes.toxicComments || 0);
    });
  });

  // --- 3. 이벤트 핸들러 및 인증 로직 ---

  /** 로그인 필요 안내 및 로그인 프로세스 시작 */
  function handleLoginRequired(e) {
    e.preventDefault();
    if (confirm("맞춤 금지어 설정은 로그인이 필요합니다.\n구글 로그인을 진행하시겠습니까?")) {
      chrome.runtime.sendMessage({ action: "login" }, () => window.close());
    }
  }

  /** 비로그인 상태로 키워드창 클릭 시 로그인 유도 */
  keywordInput.addEventListener("mousedown", (e) => {
    chrome.storage.local.get(["isLoggedIn"], (res) => {
      if (!res.isLoggedIn) handleLoginRequired(e);
    });
  });

  /** 맞춤 금지어 추가 처리 */
  const processAddKeyword = () => {
    chrome.storage.local.get(["isLoggedIn", "personalKeywords"], (res) => {
      if (!res.isLoggedIn) {
        handleLoginRequired(new Event("click"));
        return;
      }
      const keyword = keywordInput.value.trim();
      if (!keyword) return;
      const currentKeywords = res.personalKeywords || [];

      // 개수 제한 (최대 10개)
      if (currentKeywords.length >= 10) {
        showToast("키워드는 최대 10개까지만 등록 가능합니다.");
        keywordInput.value = "";
        return;
      }

      // 길이 제한 (1자 이상 10자 이하)
      if (keyword.length < 1 || keyword.length > 10) {
        showToast("키워드는 1~10자 사이로 입력해주세요.");
        return;
      }

      // 특수문자 제한 (한글, 영문, 숫자만 허용)
      const regex = /^[가-힣a-zA-Z0-9]+$/;
      if (!regex.test(keyword)) {
        showToast("특수문자는 입력할 수 없습니다.");
        return;
      }

      // 중복 등록 방지
      if (currentKeywords.includes(keyword)) {
        showToast("이미 등록된 키워드입니다.");
        keywordInput.value = "";
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "ADD_SERVER_KEYWORD",
          keyword: keyword,
        },
        (response) => {
          if (response?.status === "success") {
            // 서버 등록에 성공했을 때만 로컬 화면 및 저장소에 반영
            addTag(keyword, keywordTagsContainer);
            keywordInput.value = "";
            saveKeywords(keywordTagsContainer);
            showToast(`'${keyword}' 단어가 추가되었습니다.`);
            sendConfigChangeToYoutube();
          } else {
            showToast("서버에 키워드를 추가하지 못했습니다.");
          }
        },
      );
    });
  };

  addKeywordBtn.addEventListener("click", processAddKeyword);
  keywordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processAddKeyword();
  });

  /** 로그아웃 버튼 클릭 핸들러 */
  logoutBtn.addEventListener("click", () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    chrome.runtime.sendMessage({ action: "requestLogout" }, (response) => {
      if (response?.status === "success") {
        showToast("로그아웃 되었습니다.");
        window.location.reload(); // UI 갱신을 위한 새로고침
      }
    });
  });

  // --- 4. 사용자 설정 변경 감지 및 저장 ---

  /** 정화 단계 라디오 버튼 변경 시 저장 */
  stepRadios.forEach((r) =>
    r.addEventListener("change", (e) => {
      chrome.storage.local.set({ filterStep: e.target.value }, () => {
        sendConfigChangeToYoutube();
      });
    }),
  );

  /**
   * 메인 토글 스위치 변경 시 서비스 활성화 상태를 저장하고
   * 현재 활성화된 유튜브 탭에 상태 변경 메시지를 전송
   */
  mainToggle.addEventListener("change", (e) => {
    const isActive = e.target.checked;

    // 1. 크롬 로컬 저장소에 현재 ON/OFF 상태 기록
    chrome.storage.local.set({ serviceActive: isActive });

    // 2. 팝업창 테마 및 텍스트 UI 업데이트 (일반모드 <-> 클린모드)
    updateModeUI(isActive, DOM);

    // 3. 현재 활성화된 탭(유튜브)을 찾아 실시간 상태 변경 신호 전송
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      // 탭이 존재하고 유튜브 URL인 경우에만 메시지 전송
      if (tabs[0] && tabs[0].url?.includes("youtube.com")) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "TOGGLE_SERVICE",
            active: isActive,
          },
          (response) => {
            console.log("[토글 메시지 전송 결과]", response, chrome.runtime.lastError?.message);
          },
        );
      }
    });
  });

  /** 레이블(텍스트) 클릭으로도 토글 조작 가능하도록 설정 */
  [modeGeneralLabel, modeCleanLabel].forEach((label) => {
    label.addEventListener("click", () => {
      const targetState = label === modeCleanLabel;
      if (mainToggle.checked !== targetState) {
        mainToggle.checked = targetState;
        mainToggle.dispatchEvent(new Event("change"));
      }
    });
  });

  // --- 5. 외부 메시지 수신  ---
  chrome.runtime.onMessage.addListener((msg) => {
    // 토큰 만료 또는 로그인 취소 신호를 받았을 때 처리
    if (msg.action === "loginCancelled") {
      // 원래 팝업에서 사용하던 깔끔한 토스트 디자인 그대로 노출
      showToast("다시 로그인해주세요.");

      // 비로그인 UI로 전환
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }

    // 로그인 완료 시 팝업 갱신
    if (msg.action === "loginFinished") window.location.reload();

    /** [실시간 통계 업데이트] 백그라운드에서 전달받은 새로운 통계 수치를 UI에 반영 */
    if (msg.action === "UPDATE_STATS") {
      updateStatisticsUI(msg.totalComments, msg.toxicComments);
    }
  });
});
