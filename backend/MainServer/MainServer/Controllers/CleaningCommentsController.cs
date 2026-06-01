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
    const string QUERY_INSERT_COMMENT = "insert into cached_comments(plain_text, refined_text, is_toxic) values (@PlainText, @RefinedText, @IsToxic)";

    /// <summary>
    /// 정화 요청 처리
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="comment"></param>
    /// <param name="aiServer"></param>
    /// <returns></returns>
    [HttpPost]
    [ProducesResponseType<ResponseCommentDto>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestCleaningAsync(RequestCommentDto comment, NpgsqlDataSource dataSource, IOptions<AIServerInfo> aiServer)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        bool cached = await dbCon.QueryFirstAsync<bool>(QUERY_EXIST_CACHE, new { PlainText = comment.Text });

        if (cached == true)
        {
            CachedCommentDto cachedComment = await dbCon.QueryFirstAsync<CachedCommentDto>(QUERY_CACHED_COMMENT, new {PlainText = comment.Text});

            ResponseCommentDto response = new()
            {
                Id = comment.Id,
                ConvertedText = cachedComment.RefinedText,
                IsToxic = cachedComment.IsToxic
            };

            return Results.Ok(response);
        }
        else
        {
            using HttpClient client = new();

            var res = await client.PostAsJsonAsync(aiServer.Value.RequestURL, comment);

            var response = await res.Content.ReadFromJsonAsync<ResponseCommentDto>();

            await dbCon.ExecuteAsync(QUERY_INSERT_COMMENT, new { PlainText = comment.Text, RefinedText = response.ConvertedText, response.IsToxic });

            return Results.Ok(response);
        }
    }
}