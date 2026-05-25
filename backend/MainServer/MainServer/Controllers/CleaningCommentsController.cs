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
    static Random random = new();

    /// <summary>
    /// 정화 요청 처리
    /// </summary>
    /// <param name="comments"></param>
    /// <param name="aiServer"></param>
    /// <returns></returns>
    [HttpPost]
    [ProducesResponseType<ResponseCleaningCommentsDto>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestCleaningAsync(RequestCleaningCommentsDto comments, IOptions<AIServerInfo> aiServer)
    {
        //var requestComments = comments.Comments;
        //List<ResponseComment> responseComments = new(requestComments.Count);

        //Stat stat = new()
        //{
        //    ToxicCount = 0,
        //    TotalScanned = requestComments.Count
        //};

        //for (int i = 0; i < requestComments.Count; i++)
        //{
        //    ResponseComment comment = new()
        //    {
        //        Id = requestComments[i].Id,
        //        IsToxic = false,
        //        ConvertedText = null
        //    };

        //    if (random.Next(0, 2) == 0)
        //    {
        //        comment.IsToxic = true;
        //        comment.ConvertedText = "***" + requestComments[i].Text + "***";
        //        stat.ToxicCount++;
        //    }

        //    responseComments.Add(comment);
        //}

        //ResponseCleaningCommentsDto response = new()
        //{
        //    Results = responseComments,
        //    Stats = stat
        //};

        HttpClient client = new();

        Console.WriteLine(comments.Comments.Count);

        var res = await client.PostAsJsonAsync(aiServer.Value.RequestURL, comments);

        Console.WriteLine(res.StatusCode);

        var response = await res.Content.ReadFromJsonAsync<ResponseCleaningCommentsDto>();

        return Results.Ok(response);
    }
}