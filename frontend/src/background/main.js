// src/background/main.js
import { performLogout, fetchIDToken } from "./auth.js";

/**
 * [공통 설정] 백엔드 API 서버 주소 및 세부 엔드포인트 정의
 */
const BASE_URL = "https://404foundserver-h3cwawecfch5fbf2.koreacentral-01.azurewebsites.net";

const ENDPOINTS = {
  CLEANING: `${BASE_URL}/cleaning`,
  LOGIN: `${BASE_URL}/test/google-tokentest`,
  USER_INFO: `${BASE_URL}/test/test`,
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
      () => chrome.runtime.sendMessage({ action: "loginCancelled" }),
    );
    sendResponse({ status: "인증 프로세스 시작됨" });
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
});

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
  try {
    // [1단계] 서버 토큰 교환: 구글 JWT를 보내고 우리 서비스 전용 세션 토큰을 받음
    console.log("1단계: 서버에 구글 JWT 전송 중");
    const loginResponse = await fetch(ENDPOINTS.LOGIN, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: jwt }),
    });

    if (!loginResponse.ok) throw new Error(`로그인 서버 에러: ${loginResponse.status}`);
    const loginData = await loginResponse.json();
    const serverToken = loginData.token;

    // 발급받은 서버 전용 토큰을 로컬 저장소에 보관
    await chrome.storage.local.set({ serverToken });

    // [2단계] 유저 정보 조회: 발급받은 서버 토큰을 사용하여 유저의 상세 정보 확인
    console.log("2단계: 사용자 정보 조회를 시도합니다...");
    const infoResponse = await fetch(ENDPOINTS.USER_INFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${serverToken}` },
    });

    if (!infoResponse.ok) throw new Error(`정보 조회 에러: ${infoResponse.status}`);
    const infoData = await infoResponse.json();

    // [3단계] 최종 완료 처리: 유저 이메일 저장 및 팝업창에 로그인 성공 알림
    if (infoData.email) {
      chrome.storage.local.set({ userEmail: infoData.email, isLoggedIn: true }, () => {
        chrome.runtime.sendMessage({ action: "loginFinished", email: infoData.email });
      });
    }
  } catch (error) {
    // 에러 발생 시 로그인 상태 초기화
    console.error("통신 흐름 실패:", error.message);
    chrome.storage.local.set({ isLoggedIn: false, userEmail: "" });
  }
}
