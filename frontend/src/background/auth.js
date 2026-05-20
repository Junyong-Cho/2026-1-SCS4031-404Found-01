// src/background/auth.js
export const CLIENT_ID = "833613304454-p2kmh0hog955nfidg8ibe5hsrb3n183t.apps.googleusercontent.com";

// 로그아웃 로직
export function performLogout(callback) {
  console.log("[로그아웃] 확장 프로그램 로컬 세션 폐기 프로세스 가동");

  // 브라우저 로컬 저장소 내부 세션 정보 자체 폐기
  chrome.storage.local.remove(["isLoggedIn", "userEmail", "personalKeywords", "serverToken"], () => {
    console.log("[로그아웃] 내부 모든 로그인 인증 토큰 자체 폐기 완료");
    if (callback) callback();
  });
}

// 구글 ID 토큰 획득 로직
export function fetchIDToken(onSuccess, onFailure) {
  const REDIRECT_URL = chrome.identity.getRedirectURL();
  const nonce = Math.random().toString(36).substring(2);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `response_type=id_token&` +
    `access_type=online&` +
    `prompt=select_account&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URL)}&` +
    `scope=${encodeURIComponent("openid email profile")}&` +
    `nonce=${encodeURIComponent(nonce)}`;

  console.log("[인증 시작] 구글인증 주소 웹플로우 바인딩 완료");

  // 브라우저에 인증 팝업창 띄우기
  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
    if (chrome.runtime.lastError || !redirectUrl) {
      console.error("[인증 실패] 유저가 창을 닫았거나 인증이 취소되었습니다.");
      if (onFailure) onFailure();
      return;
    }

    // 🛠️ 크롬의 가상 도메인 주소 체계 유실을 방지하기 위해 정밀 슬라이싱 파싱을 적용합니다.
    try {
      const hashSegment = redirectUrl.split("#")[1];
      if (!hashSegment) throw new Error("해시 데이터 필드가 비어있습니다.");

      const params = new URLSearchParams(hashSegment);
      const idToken = params.get("id_token");

      console.log("=== [인증 결과 확인] id_token 획득 성공 유무 ===", !!idToken);

      if (idToken && onSuccess) {
        onSuccess(idToken);
      } else {
        throw new Error("구글 OAuth 서버가 id_token 발행을 거절했습니다.");
      }
    } catch (error) {
      console.error("[파싱 실패] 토큰 분석 실패:", error.message);
      if (onFailure) onFailure();
    }
  });
}
