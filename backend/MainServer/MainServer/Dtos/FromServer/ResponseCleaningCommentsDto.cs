using MainServer.Dtos.FromClient;

namespace MainServer.Dtos.FromServer;

/// <summary>
/// 정화 요청에 대한 응답 DTO
/// </summary>
public struct ResponseCleaningCommentsDto
{
    /// <summary>
    /// 응답 댓글 리스트
    /// </summary>
    public ResponseComment[] Results { get; set; }

    /// <summary>
    /// 통계
    /// </summary>
    public Stat Stats { get; set; }
}

/// <summary>
/// 응답 댓글
/// </summary>
public struct ResponseComment
{
    /// <summary>
    /// 댓글 ID
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// 독성 여부
    /// </summary>
    public bool IsToxic { get; set; }

    /// <summary>
    /// 독성 타입
    /// </summary>
    public string ToxicType { get; set; }

    /// <summary>
    /// 정화문
    /// </summary>
    public string? ConvertedText { get; set; }
}

/// <summary>
/// 유독성 댓글 통계
/// </summary>
public struct Stat
{
    /// <summary>
    /// 독성 댓글 수
    /// </summary>
    public int ToxicCount { get; set; }

    /// <summary>
    /// 전체 댓글 수
    /// </summary>
    public int TotalScanned { get; set; }
}