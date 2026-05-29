using Dapper;
using MainServer.Dtos.FromClient;
using MainServer.Dtos.FromServer;
using MainServer.Infos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Npgsql;

namespace MainServer.Controllers;

/// <summary>
/// 정화 요청 API
/// </summary>
[ApiController]
[Route("/cleaning")]
public class CleaningCommentsController : ControllerBase
{
    const string QUERY_EXIST_CACHE = "select exists (select 1 from cached_comments where plain_text=@PlainText)";
    const string QUERY_CACHED_COMMENT = "select * from cached_comments where plain_text=@PlainText";
    const string QUERY_INSERT_COMMENT = "insert into plain_text(plain_text, refined_text, is_toxic) values (@PlainText, @RefinedText, @IsToxic)";

    /// <summary>
    /// 정화 요청 처리
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="comment"></param>
    /// <param name="aiServer"></param>
    /// <returns></returns>
    [HttpPost]
    [ProducesResponseType<ResponseCommentDto>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestCleaningAsync(NpgsqlDataSource dataSource, RequestCommentDto comment, IOptions<AIServerInfo> aiServer)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        var plain = new { PlainText = comment.Text };

        bool cached = await dbCon.QueryFirstAsync(QUERY_EXIST_CACHE, plain);

        if (cached == true)
        {
            CachedCommentDto cache = await dbCon.QueryFirstAsync(QUERY_CACHED_COMMENT, plain);

            ResponseCommentDto response = new()
            {
                Id = comment.Id,
                ConvertedText = cache.RefinedText,
                IsToxic = cache.IsToxic
            };

            return Results.Ok(response);
        }
        else
        {
            using HttpClient client = new();

            var res = await client.PostAsJsonAsync(aiServer.Value.RequestURL, comment);

            var response = await res.Content.ReadFromJsonAsync<ResponseCommentDto>();

            await dbCon.ExecuteAsync(QUERY_INSERT_COMMENT, new { PlainText = comment.Text, RefinedText = response.ConvertedText, IsToxic = response.IsToxic });
            
            return Results.Ok(response);
        }
    }
}