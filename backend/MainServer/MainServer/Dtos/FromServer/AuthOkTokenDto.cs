namespace MainServer.Dtos.FromServer;

/// <summary>
/// 서버에서 부여하는 인증 토큰 전달 객체
/// </summary>
public struct AuthOkTokenDto
{
    /// <summary>
    /// 서버에서 부여하는 인증 토큰
    /// </summary>
    public string Token { get; set; }
}
