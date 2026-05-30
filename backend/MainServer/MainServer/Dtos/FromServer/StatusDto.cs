namespace MainServer.Dtos.FromServer;

/// <summary>
/// 상태 통계 형식
/// </summary>
public struct StatusDto
{
    /// <summary>
    /// 상태
    /// </summary>
    public string Status { get; set; }

    /// <summary>
    /// 개수
    /// </summary>
    public int Count { get; set; }
}
