namespace MainServer.Infos;

/// <summary>
/// 서버 인증 토큰 정보
/// </summary>
public class ServerInfo
{
    /// <summary>
    /// 서버 토큰 Issuer
    /// </summary>
    public string Issuer { get; set; } = null!;

    /// <summary>
    /// 서버 토큰 Audience
    /// </summary>
    public string Audience { get; set; } = null!;

    /// <summary>
    /// 토큰 만료 시간
    /// </summary>
    public int ExpireHours { get; set; }
}
