namespace MainServer.Dtos.FromServer;

/// <summary>
/// 피드백 반환 형식
/// </summary>
public struct ResponseFeedbackDto
{
    /// <summary>
    /// 피드백 Id
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// 동영상 주소
    /// </summary>
    public string VideoUrl { get; set; }

    /// <summary>
    /// 원문
    /// </summary>
    public string PlainText { get; set; }

    /// <summary>
    /// 정화문 null 허용
    /// </summary>
    public string? ConvertedText { get; set; }

    /// <summary>
    /// 피드백
    /// </summary>
    public string Feedback { get; set; }

    /// <summary>
    /// 생성 시각
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// 상태
    /// </summary>
    public string Status { get; set; }

    /// <summary>
    /// 태그 리스트
    /// </summary>
    public IEnumerable<string> Tags { get; set; }
}
