namespace MainServer.Settings;

/// <summary>
/// 구글 토큰 인증 정보
/// </summary>
public class GoogleInfoSettings
{
    /// <summary>
    /// 구글 토큰 Issuer
    /// </summary>
    public const string GOOGLE_URL = "https://account.google.com";

    /// <summary>
    /// 구글 토큰 Audience
    /// </summary>
    public string ClientId { get; set; } = null!;
    /// <summary>
    /// 구글 시크릿
    /// </summary>
    public string ClientSecret { get; set; } = null!;
}
