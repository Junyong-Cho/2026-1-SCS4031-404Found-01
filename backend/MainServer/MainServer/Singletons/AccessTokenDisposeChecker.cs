using Microsoft.Extensions.Caching.Memory;

namespace MainServer.Singletons;

/// <summary>
/// 폐기되었지만 유효기간이 만료되지 않은 토큰 저장
/// </summary>
public class AccessTokenDisposeChecker
{
    readonly IMemoryCache _cache;

    /// <summary>
    /// 생성자 DI로 IMemoryCache 주입
    /// </summary>
    /// <param name="cache"></param>
    public AccessTokenDisposeChecker(IMemoryCache cache)
    {
        _cache = cache;
    }

    /// <summary>
    /// 토큰 폐기
    /// </summary>
    /// <param name="jti"></param>
    /// <param name="expires"></param>
    public void DisposeToken(string jti, DateTimeOffset expires)
    {
        _cache.Set(jti, string.Empty, expires);
    }

    /// <summary>
    /// 폐기된 토큰 확인
    /// </summary>
    /// <param name="jti"></param>
    /// <returns></returns>
    public bool CheckDisposed(string jti)
    {
        return _cache.TryGetValue(jti, out _);
    }
}
