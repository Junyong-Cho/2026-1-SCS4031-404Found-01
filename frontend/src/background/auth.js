export const CLIENT_ID = "833613304454-p2kmh0hog955nfidg8ibe5hsrb3n183t.apps.googleusercontent.com";

// TODO 로그아웃 로직
export function performLogout(callback) {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token: token }, () => {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
      });
    }
    chrome.storage.local.remove(["isLoggedIn", "userEmail", "personalKeywords"], () => {
      console.log("로그인 관련 정보만 삭제 완료");
      if (callback) callback();
    });
  });
}

// 구글 ID 토큰 획득 로직
export function fetchIDToken(onSuccess, onFailure) {
  const REDIRECT_URL = chrome.identity.getRedirectURL();
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `response_type=id_token&` +
    `access_type=online&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URL)}&` +
    `scope=${encodeURIComponent("openid email profile")}&` +
    `nonce=${Math.random().toString(36).substring(2)}`; // 보안을 위한 임시 랜덤값 (재전송 공격 방지)
  // 브라우저에 인증 팝업창 띄우기
  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
    if (chrome.runtime.lastError || !redirectUrl) {
      console.error("인증 실패 또는 취소됨");
      if (onFailure) onFailure();
      return;
    }
    // 인증 결과 URL에서 토큰 추출
    const url = new URL(redirectUrl);
    const params = new URLSearchParams(url.hash.substring(1));
    const idToken = params.get("id_token");
    if (idToken && onSuccess) onSuccess(idToken);
  });
}
