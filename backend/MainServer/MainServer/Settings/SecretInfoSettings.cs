namespace MainServer.Settings;

/// <summary>
/// 서버 비밀 정보
/// </summary>
public class SecretInfoSettings
{
    /// <summary>
    /// base64로 인코딩된 비밀 키
    /// </summary>
    public string Key { get; set; } = null!;
}
