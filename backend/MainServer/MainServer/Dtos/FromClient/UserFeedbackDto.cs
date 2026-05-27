namespace MainServer.Dtos.FromClient;


/// <summary>
/// 유저 피드백 정보
/// </summary>
public struct UserFeedbackDto
{
    /// <summary>
    /// DB 저장 Id (클라이언트 전송 X)
    /// </summary>
    public Guid? Id { get; set; }

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
    /// 태그
    /// </summary>
    public List<string> Tags { get; set; }
}