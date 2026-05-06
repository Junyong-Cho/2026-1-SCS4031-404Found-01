using MainServer.Dtos.FromClient;
using MainServer.Dtos.FromServer;
using Microsoft.AspNetCore.Mvc;

namespace MainServer.Controllers;

/// <summary>
/// 정화 요청 API
/// </summary>
[ApiController]
[Route("/cleaning")]
public class CleaningCommentsController : ControllerBase
{
    static Random random = new();

    /// <summary>
    /// 특정 확률로 정화
    /// </summary>
    /// <param name="comments"></param>
    /// <returns></returns>
    [HttpPost]
    public async Task<IResult> RequestCleaningAsync(RequestCleaningCommentsDto comments)
    {
        var requestComments = comments.Comments;
        var responseComments = new ResponseComment[requestComments.Length];

        Stat stat = new()
        {
            ToxicCount = 0,
            TotalScanned = requestComments.Length
        };

        for (int i = 0; i < requestComments.Length; i++)
        {
            ResponseComment comment = new()
            {
                Id = requestComments[i].Id,
                IsToxic = false,
                ToxicType = string.Empty,
                ConvertedText = null
            };

            if (random.Next(0, 2) == 0)
            {
                comment.IsToxic = true;
                comment.ConvertedText = "***" + requestComments[i].Text + "***";
                stat.ToxicCount++;
            }

            responseComments[i] = comment;
        }

        ResponseCleaningCommentsDto response = new()
        {
            Results = responseComments,
            Stats = stat
        };

        return Results.Ok(response);
    }
}
