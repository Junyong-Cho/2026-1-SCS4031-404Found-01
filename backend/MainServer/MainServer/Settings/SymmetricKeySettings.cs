using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace MainServer.Settings;

/// <summary>
/// 서버 비밀키 정보
/// </summary>
public class SymmetricKeySettings
{
    byte[] Key;

    /// <summary>
    /// 대칭 키
    /// </summary>
    public SymmetricSecurityKey SymmetricKey { get; private set; }

    /// <summary>
    /// 키 생성
    /// </summary>
    /// <param name="options"></param>
    public SymmetricKeySettings(IOptions<SecretInfoSettings> options)
    {
        Key = Convert.FromBase64String(options.Value.Key);

        SymmetricKey = new(Key);
    }
}
