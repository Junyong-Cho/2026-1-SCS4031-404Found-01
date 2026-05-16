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

    /// <summary>
    /// 유저가 설정한 키워드 리스트
    /// </summary>
    public List<string> ForbidenWords { get; set; }
}
