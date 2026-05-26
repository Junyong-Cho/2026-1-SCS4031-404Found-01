using MainServer.Dtos.FromClient;
using MainServer.Dtos.FromServer;
using MainServer.Infos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace MainServer.Controllers;

/// <summary>
/// 정화 요청 API
/// </summary>
[ApiController]
[Route("/cleaning")]
public class CleaningCommentsController : ControllerBase
{

    /// <summary>
    /// 정화 요청 처리
    /// </summary>
    /// <param name="comment"></param>
    /// <param name="aiServer"></param>
    /// <returns></returns>
    [HttpPost]
    [ProducesResponseType<ResponseCommentDto>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestCleaningAsync(RequestCommentDto comment, IOptions<AIServerInfo> aiServer)
    {
        using HttpClient client = new();

        var res = await client.PostAsJsonAsync(aiServer.Value.RequestURL, comment);

        var response = await res.Content.ReadFromJsonAsync<ResponseCommentDto>();

        return Results.Ok(response);
    }
}