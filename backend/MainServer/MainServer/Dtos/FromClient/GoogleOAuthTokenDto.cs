namespace MainServer.Dtos.FromClient;

/// <summary>
/// 구글 인증 요청 토큰 전달 객체
/// </summary>
public struct GoogleOAuthTokenDto
{
    /// <summary>
    /// OAuth로 받은 토큰
    /// </summary>
    public string Token { get; set; }
}
