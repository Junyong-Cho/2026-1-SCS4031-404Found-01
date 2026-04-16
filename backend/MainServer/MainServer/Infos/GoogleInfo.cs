namespace MainServer.Infos;


/// <summary>
/// 구글 토큰 인증 정보
/// </summary>
public class GoogleInfo
{

    /// <summary>
    /// 구글 토큰 Issuer https://account.google.com
    /// </summary>
    public string Issuer { get; set; } = null!;

    /// <summary>
    /// 구글 토큰 Audience
    /// </summary>
    public string Audience { get; set; } = null!;

    /// <summary>
    /// OAuth 클라이언트 암호
    /// </summary>
    public string ClientSecret { get; set; } = null!;
}
