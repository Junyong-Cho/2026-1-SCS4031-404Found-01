namespace MainServer.Dtos.FromClient;

/// <summary>
/// 댓글 정화 요청 DTO
/// </summary>
public struct RequestCleaningCommentsDto
{
    /// <summary>
    /// 유저 설정
    /// </summary>
    public string UserSetting { get; set; }

    /// <summary>
    /// 댓글 리스트
    /// </summary>
    public List<RequestComment> Comments { get; set; }
}

/// <summary>
/// 댓글 DTO
/// </summary>
public struct RequestComment
{
    /// <summary>
    /// 댓글 ID
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// 댓글 내용
    /// </summary>
    public string Text { get; set; }
}