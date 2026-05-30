namespace MainServer.Dtos.FromServer;

/// <summary>
/// 태그 통계
/// </summary>
public struct TagStatDto
{
    /// <summary>
    /// 태그 이름
    /// </summary>
    public string Tag { get; set; }

    /// <summary>
    /// 태그 수
    /// </summary>
    public int Count { get; set; }
}
