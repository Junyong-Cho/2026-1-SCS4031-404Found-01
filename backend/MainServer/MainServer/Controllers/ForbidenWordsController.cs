using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace MainServer.Controllers;


/// <summary>
/// 금지어 관리 컨트롤러
/// </summary>
[ApiController]
[Route("/forbid")]
public class ForbidenWordsController : ControllerBase
{
    const string QUERY_INSERT_FORBIDEN_WORD = "insert into forbiden_words (user_id, f_word) values (@UserId, @Keyword)";
    const string QUERY_DELETE_FORBIDEN_WORD = "delete from forbiden_words where user_id=@UserId and f_word=@Keyword";

    /// <summary>
    /// 키워드 추가
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="keyword"></param>
    /// <returns></returns>
    [Authorize]
    [HttpGet("add/{keyword}")]
    public async Task<IResult> RequestAddForbidenWords(NpgsqlDataSource dataSource, string keyword)
    {
        string userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

        await using var dbCon = await dataSource.OpenConnectionAsync();

        try
        {
            await dbCon.ExecuteAsync(QUERY_INSERT_FORBIDEN_WORD, new { userId, keyword });

            return Results.Ok();
        }
        catch (Exception e)
        {
            return Results.InternalServerError(e);
        }
    }

    /// <summary>
    /// 키워드 삭제
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="keyword"></param>
    /// <returns></returns>
    [Authorize]
    [HttpDelete("delete/{keyword}")]
    public async Task<IResult> RequestDeleteForbidenWords(NpgsqlDataSource dataSource, string keyword)
    {
        string userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

        await using var dbCon = await dataSource.OpenConnectionAsync();

        try
        {
            await dbCon.ExecuteAsync(QUERY_DELETE_FORBIDEN_WORD, new { userId, keyword });

            return Results.Ok();
        }
        catch(Exception e)
        {
            return Results.InternalServerError(e);
        }
    }
}
