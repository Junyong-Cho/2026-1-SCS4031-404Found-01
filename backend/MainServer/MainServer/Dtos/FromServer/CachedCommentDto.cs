namespace MainServer.Dtos.FromServer;

/// <summary>
/// 댓글 캐싱
/// </summary>
public struct CachedCommentDto
{
    /// <summary>
    /// 원문
    /// </summary>
    public string PlainText { get; set; }

    /// <summary>
    /// 정화문 (독성 X면 null)
    /// </summary>
    public string? RefinedText { get; set; }

    /// <summary>
    /// 독성 여부
    /// </summary>
    public bool IsToxic { get; set; }
}
