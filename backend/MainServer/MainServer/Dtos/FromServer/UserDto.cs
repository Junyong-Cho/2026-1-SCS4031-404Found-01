namespace MainServer.Dtos.FromServer;

/// <summary>
/// 유저 정보 전달 객체
/// </summary>
public struct UserDto
{
    /// <summary>
    /// 유저 아이디
    /// </summary>
    public string UserId { get; set; }

    /// <summary>
    /// 유저 이메일
    /// </summary>
    public string Email { get; set; }
}
