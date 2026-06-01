// src/background/main.js
import { performLogout, fetchIDToken } from "./auth.js";

/**
 * [공통 설정] 백엔드 API 서버 주소 및 세부 엔드포인트 정의
 */
const BASE_URL = "https://404found-main-cwfvhyehgngaexds.koreacentral-01.azurewebsites.net";

const ENDPOINTS = {
  CLEANING: `${BASE_URL}/cleaning`,
  SIGNIN: `${BASE_URL}/auth/google-signin`,
  FORBID_BASE: `${BASE_URL}/forbid`,
  REPORT: `${BASE_URL}/report`,
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

  // 4. 통계 수치 업데이트 처리 (ID 기반 중복 방지 우회 구조)
  if (request.type === "ADD_LAUNDRY_STATS") {
    const { lcId, isToxic } = request;

    chrome.storage.session.get(["scannedIds", "toxicIds"], (res) => {
      const safeRes = res || {};
      const scannedIds = safeRes.scannedIds || [];
      const toxicIds = safeRes.toxicIds || [];

      // 이미 통계에 반영된 댓글 ID라면 중복 처리 스킵
      if (scannedIds.includes(lcId)) {
        sendResponse({ status: "duplicated" });
        return;
      }

      // 새로운 유니크 ID 배열에 등록
      scannedIds.push(lcId);
      if (isToxic) {
        toxicIds.push(lcId);
      }

      const totalCount = scannedIds.length;
      const toxicCount = toxicIds.length;

      // 세션 스토리지에 배열과 카운트를 함께 저장
      chrome.storage.session.set(
        {
          scannedIds: scannedIds,
          toxicIds: toxicIds,
          totalComments: totalCount,
          toxicComments: toxicCount,
        },
        () => {
          // 팝업 UI로 실시간 데이터 전송
          chrome.runtime.sendMessage(
            {
              action: "UPDATE_STATS",
              totalComments: totalCount,
              toxicComments: toxicCount,
            },
            () => {
              void chrome.runtime.lastError;
            },
          );

          sendResponse({ status: "success", total: totalCount, toxic: toxicCount });
        },
      );
    });
    return true;
  }

  // 5. 서버 금지어 추가 요청 처리
  if (request.type === "ADD_SERVER_KEYWORD") {
    syncKeywordWithServer("GET", `add/${encodeURIComponent(request.keyword)}`, sendResponse);
    return true;
  }

  // 6. 서버 금지어 삭제 요청 처리
  if (request.type === "DELETE_SERVER_KEYWORD") {
    syncKeywordWithServer("DELETE", `delete/${encodeURIComponent(request.keyword)}`, sendResponse);
    return true;
  }

  // 7. 피드백 전송 요청 처리 (채널 유실 완벽 방지 구조)
  if (request.type === "SEND_FEEDBACK") {
    processFeedbackSubmit(request.data)
      .then((result) => {
        sendResponse({ status: "success" });
      })
      .catch((err) => {
        console.error("[댓글세탁소] 피드백 백그라운드 catch 진입:", err.message);

        if (err.message.includes("401") || err.message.includes("UNAUTHORIZED")) {
          console.warn("[댓글세탁소] 세션 만료 감지 ➔ 자동 로그아웃 및 스토리지 초기화를 시작합니다.");

          handleTokenExpired();
        }
        sendResponse({ status: "error", error: err.message });
      });

    return true; // 비동기 채널 유지
  }
});
/**
 * 유저가 모달 창에 입력한 피드백 데이터 서버로 전송
 */
async function processFeedbackSubmit(clientData) {
  try {
    const { serverToken } = await chrome.storage.local.get("serverToken");

    const headers = {
      "Content-Type": "application/json",
    };

    if (serverToken) {
      headers["Authorization"] = `Bearer ${serverToken}`;
    }

    const payload = {
      id: clientData.id || null,
      videoUrl: clientData.videoUrl || "",
      plainText: clientData.plainText || "",
      convertedText: clientData.convertedText || "",
      feedback: clientData.reason || "",
      tags: clientData.tags || [],
    };

    console.log("[댓글세탁소] 피드백 서버 전송 시작:", JSON.stringify(payload, null, 2));

    const response = await fetch(ENDPOINTS.REPORT, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      throw new Error("ERROR_CODE_401_UNAUTHORIZED");
    }
    if (!response.ok) {
      throw new Error(`피드백 서버 응답 에러: ${response.status}`);
    }

    console.log("[댓글세탁소] 피드백 서버 전송 완료");
    return true;
  } catch (error) {
    console.error("피드백 전송 실패 내부 로그:", error);
    throw error;
  }
}

/**
 * 백엔드 서버로 금지어 동기화 API 호출 (패스 파라미터 방식 반영)
 * @param {string} method - "GET" 또는 "DELETE"
 * @param {string} subPath - 추가 시 "add/단어", 삭제 시 "delete/단어"
 * @param {Function} sendResponse - 프론트엔드로 결과를 보낼 콜백 함수
 */
async function syncKeywordWithServer(method, subPath, sendResponse) {
  try {
    const { serverToken } = await chrome.storage.local.get("serverToken");

    // 토큰 자체가 없으면 만료 처리하지 않고 그냥 에러 반환
    if (!serverToken) {
      sendResponse({ status: "error", error: "로그인이 필요합니다." });
      return;
    }

    const targetUrl = `${ENDPOINTS.FORBID_BASE}/${subPath}`;
    const response = await fetch(targetUrl, {
      method: method,
      headers: {
        Authorization: `Bearer ${serverToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      // 현재 저장된 토큰과 요청에 사용한 토큰이 같을 때만 만료 처리
      const { serverToken: currentToken } = await chrome.storage.local.get("serverToken");
      if (currentToken === serverToken) {
        handleTokenExpired();
      }
      throw new Error("다시 로그인해주세요.");
    }

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);
    sendResponse({ status: "success" });
  } catch (error) {
    console.error(`서버 금지어 동기화 실패 (${method}):`, error);
    sendResponse({ status: "error", error: error.message });
  }
}

function handleTokenExpired() {
  performLogout(() => {
    chrome.runtime.sendMessage({ action: "loginCancelled" }, () => {
      void chrome.runtime.lastError;
    });
  });
}

/**
 * [함수] processCleaning
 * 역할: 추출된 유튜브 댓글을 서버로 전송하여 악플 판별 및 순화 텍스트 수신 (비로그인 대응)
 */
async function processCleaning(payload, sendResponse) {
  try {
    // 1. 저장된 서버 인증 토큰 가져오기
    const { serverToken } = await chrome.storage.local.get("serverToken");

    // 2. 로그인 여부에 따라 헤더를 동적으로 세팅 (안전장치)
    const headers = {
      "Content-Type": "application/json",
    };

    // 토큰이 존재할 때만 Authorization 헤더를 추가 (로그아웃 상태면 안 보냄)
    if (serverToken) {
      headers["Authorization"] = `Bearer ${serverToken}`;
    }

    // 3. 백엔드 정화 API 호출
    const response = await fetch(ENDPOINTS.CLEANING, {
      method: "POST",
      headers: headers, // 동적으로 가공된 헤더 주입
      body: JSON.stringify(payload), // { comments: [{id, text}, ...] }
    });

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);

    // 4. 정화 결과(results, stats)를 응답함
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

    // 유저 이메일은 JWT 디코딩으로 추출
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    await chrome.storage.local.set({ userEmail: payload.email });

    chrome.runtime.sendMessage({ action: "loginFinished", email: payload.email }, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    console.error("통신 흐름 실패:", error.message);
    chrome.storage.local.set({ isLoggedIn: false, userEmail: "" });
    chrome.runtime.sendMessage({ action: "loginCancelled" });
  }
}
