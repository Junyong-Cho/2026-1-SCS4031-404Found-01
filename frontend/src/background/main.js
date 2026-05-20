// src/background/main.js
import { performLogout, fetchIDToken } from "./auth.js";

/**
 * [공통 설정] 백엔드 API 서버 주소 및 세부 엔드포인트 정의
 */
const BASE_URL = "https://404found-main-cwfvhyehgngaexds.koreacentral-01.azurewebsites.net";

const ENDPOINTS = {
  CLEANING: `${BASE_URL}/cleaning`,
  SIGNIN: `${BASE_URL}/auth/google-signin`,
  FORBIDDEN_WORD: `${BASE_URL}/forbidden-word`,
};

/**
 * [이벤트 리스너] 팝업 UI나 콘텐츠 스크립트에서 보내는 메시지를 수신하여 처리
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. 로그인 요청 처리
  if (request.action === "login" || request.action === "forceLogin") {
    fetchIDToken(
      // 구글 토큰 획득 성공 시: 백엔드 서버로 전송하여 세션 확립
      (jwt) => sendTokenToBackend(jwt),
      // 구글 로그인 취소/실패 시: 취소 메시지 브로드캐스팅
      () =>
        chrome.runtime.sendMessage({ action: "loginCancelled" }, () => {
          void chrome.runtime.lastError;
        }),
    );
    sendResponse({ status: "인증 프로세스 시작됨" });
    return true;
  }

  // 2. 로그아웃 요청 처리
  if (request.action === "requestLogout") {
    performLogout(() => {
      // 브라우저 로컬 저장소의 모든 사용자 데이터 초기화
      chrome.storage.local.set(
        {
          isLoggedIn: false,
          userEmail: "",
          personalKeywords: [],
          serverToken: "", // 서버 전용 인증 토큰 삭제
        },
        () => {
          sendResponse({ status: "success" });
        },
      );
    });
    return true;
  }

  // 3. 댓글 정화 요청 처리 (Content Script로부터 수신)
  if (request.type === "PROCESS_COMMENTS") {
    processCleaning(request.data, sendResponse);
    return true;
  }

  // 4. 통계 수치 업데이트 처리 (Content Script로부터 수신)
  if (request.type === "UPDATE_LAUNDRY_STATS") {
    const stats = request.stats;

    // 브라우저 권한이 확실한 백그라운드 컨텍스트에서 session 스토리지 제어
    chrome.storage.session.get(["totalComments", "toxicComments"], (res) => {
      const newTotal = (res.totalComments || 0) + (stats.totalScanned || 0);
      const newToxic = (res.toxicComments || 0) + (stats.toxicCount || 0);

      chrome.storage.session.set({ totalComments: newTotal, toxicComments: newToxic }, () => {
        chrome.runtime.sendMessage(
          {
            action: "UPDATE_STATS",
            totalComments: newTotal,
            toxicComments: newToxic,
          },
          () => {
            const _ = chrome.runtime.lastError;
          },
        );

        sendResponse({ status: "success" });
      });
    });
    return true;
  }

  // 5. 서버 금지어 추가 요청 처리
  if (request.type === "ADD_SERVER_KEYWORD") {
    syncKeywordWithServer("POST", { word: request.keyword }, sendResponse);
    return true;
  }

  // 6. 서버 금지어 삭제 요청 처리
  if (request.type === "DELETE_SERVER_KEYWORD") {
    syncKeywordWithServer("DELETE", { word: request.keyword }, sendResponse);
    return true;
  }
});

/**
 * 백엔드 서버로 금지어 동기화 API 호출
 * @param {string} method - "POST" (추가) 또는 "DELETE" (삭제)
 * @param {Object} body - 전송할 데이터 객체 ({ word: "단어" })
 */
async function syncKeywordWithServer(method, body, sendResponse) {
  try {
    const { serverToken } = await chrome.storage.local.get("serverToken");

    const response = await fetch(ENDPOINTS.FORBIDDEN_WORD, {
      method: method,
      headers: {
        Authorization: `Bearer ${serverToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);

    // 정상 처리 완료 응답 회신
    sendResponse({ status: "success" });
  } catch (error) {
    console.error(`서버 금지어 동기화 실패 (${method}):`, error);
    sendResponse({ status: "error", error: error.message });
  }
}

/**
 * [함수] processCleaning
 * @param {Object} payload - 정화 단계(userSetting)와 댓글 리스트(comments)가 포함된 객체
 * @param {Function} sendResponse - 처리 결과를 다시 콘텐츠 스크립트로 전달하는 콜백
 * 역할: 추출된 유튜브 댓글을 서버로 전송하여 악플 판별 및 순화 텍스트 수신
 */
async function processCleaning(payload, sendResponse) {
  try {
    // 1. 저장된 서버 인증 토큰 가져오기
    const { serverToken } = await chrome.storage.local.get("serverToken");

    // 2. 백엔드 정화 API 호출
    const response = await fetch(ENDPOINTS.CLEANING, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverToken}`, // OAuth 인증 토큰 첨부
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload), // { userSetting, comments: [{id, text}, ...] }
    });

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);

    // 3. 정화 결과(results, stats)를 응답함
    const resultData = await response.json();
    sendResponse(resultData);
  } catch (error) {
    console.error("정화 프로세스 실패:", error);
    sendResponse({ error: error.message });
  }
}

/**
 * [함수] sendTokenToBackend
 * @param {string} jwt - 구글로부터 발급받은 ID Token
 * 역할: 구글 토큰을 우리 서버 토큰으로 교환하고, 유저 정보를 확인하여 최종 로그인 처리
 */
async function sendTokenToBackend(jwt) {
  console.log("JWT 전체:", jwt);

  // JWT 디코딩해서 내용 확인
  try {
    const decoded = JSON.parse(atob(jwt.split(".")[1]));
    console.log("JWT 페이로드:", decoded);
    console.log("만료시간:", new Date(decoded.exp * 1000));
  } catch (e) {
    console.error("JWT 디코딩 실패 - 토큰이 이상함:", e);
  }

  try {
    const signinResponse = await fetch(ENDPOINTS.SIGNIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: jwt }),
    });

    if (!signinResponse.ok) throw new Error(`로그인 서버 에러: ${signinResponse.status}`);

    const signinData = await signinResponse.json();
    const { token: serverToken, forbidenWords } = signinData;

    // 3단계: 저장 및 완료 처리
    await chrome.storage.local.set({
      serverToken,
      isLoggedIn: true,
      personalKeywords: forbidenWords || [],
    });

    // 유저 이메일은 JWT 디코딩으로 추출 (서버 별도 호출 불필요)
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    await chrome.storage.local.set({ userEmail: payload.email });

    chrome.runtime.sendMessage({ action: "loginFinished", email: payload.email }, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    console.error("통신 흐름 실패:", error.message);
    chrome.storage.local.set({ isLoggedIn: false, userEmail: "" });
  }
}

/**
 * [컨텍스트 메뉴] 드래그한 단어 추가 기능
 */

// 1. 설치 시 메뉴 생성 (텍스트 드래그 시에만 노출)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ADD_KEYWORD_MENU",
    title: "'%s'을(를) 맞춤 금지어로 추가",
    contexts: ["selection"],
  });
});

// 2. 메뉴 클릭 핸들러
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ADD_KEYWORD_MENU") {
    const keyword = info.selectionText.trim();

    // (A) 로그인 체크
    const { isLoggedIn, personalKeywords = [] } = await chrome.storage.local.get(["isLoggedIn", "personalKeywords"]);

    if (!isLoggedIn) {
      notifyContentScript(tab.id, "ERROR", "로그인이 필요한 기능입니다.");
      return;
    }

    // (B) 유효성 검사 (팝업과 동일한 로직)
    // 1. 길이 제한 (1~10자)
    if (keyword.length < 1 || keyword.length > 10) {
      notifyContentScript(tab.id, "ERROR", "키워드는 1~10자 사이여야 합니다.");
      return;
    }

    // 2. 특수문자 제한 (한글, 영문, 숫자만)
    const regex = /^[가-힣a-zA-Z0-9]+$/;
    if (!regex.test(keyword)) {
      notifyContentScript(tab.id, "ERROR", "특수문자는 추가할 수 없습니다.");
      return;
    }

    // 3. 중복 체크
    if (personalKeywords.includes(keyword)) {
      notifyContentScript(tab.id, "ERROR", "이미 등록된 키워드입니다.");
      return;
    }

    // 4. 개수 제한 (10개)
    if (personalKeywords.length >= 10) {
      notifyContentScript(tab.id, "ERROR", "키워드는 최대 10개까지만 가능합니다.");
      return;
    }

    // (C) 최종 저장
    const updated = [...personalKeywords, keyword];
    await chrome.storage.local.set({ personalKeywords: updated });

    // 성공 토스트 알림 지시
    notifyContentScript(tab.id, "SUCCESS", `'${keyword}' 추가 완료!`);
  }
});

/**
 * 페이지(Content Script)로 알림 메시지 전송
 */
function notifyContentScript(tabId, status, message) {
  chrome.tabs.sendMessage(
    tabId,
    {
      action: "SHOW_TOAST",
      status: status,
      message: message,
    },
    () => void chrome.runtime.lastError,
  );
}
