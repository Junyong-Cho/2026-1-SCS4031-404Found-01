namespace MainServer.Settings;

/// <summary>
/// 서버 토큰 인증 정보
/// </summary>
public class TokenInfoSettings
{
    /// <summary>
    /// 서버 인증 Issuer
    /// </summary>
    public string? Issuer { get; set; }
    
    /// <summary>
    /// 서버 인증 Audience
    /// </summary>
    public string? Audience { get; set; }

    /// <summary>
    /// 토큰 만료 시간
    /// </summary>
    public int ExpireHours { get; set; }
}
