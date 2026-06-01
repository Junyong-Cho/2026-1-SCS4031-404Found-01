using Dapper;
using MainServer.Dtos.FromClient;
using MainServer.Dtos.FromServer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace MainServer.Controllers;

/// <summary>
/// 유저 피드백
/// </summary>
[ApiController]
[Route("/report")]
public class DashBoardController : ControllerBase
{
    const string INSERT_QUERY =
@"insert into user_feedback (id, video_url, plain_text, converted_text, feedback) values (@Id, @VideoUrl, @PlainText, @ConvertedText, @Feedback);

insert into tags (tag) select unnest(@Tags) on conflict (tag) do update set count = tags.count+1;

insert into feedback_tag select @Id, unnest(@Tags);
";
    const string QUERY_TAG_STATIC = "select * from tags";
    const string QUERY_FEEDBACKS = "select * from user_feedback";
    const string QUERY_TAGS = "select tag from feedback_tag where feedback_id=@Id";
    const string QUERY_STATUS_STATIC = "select status, count(*) as count from user_feedback group by status";
    const string QUERY_DELETE_FEEDBACK_ALL =
@"
update tags set count = 0;
delete from user_feedback;
delete from feedback_tag;
";

    const string QUERY_DELETE_FEEDBACK_ONE =
@" update tags set count = count - 1 where tag in (select tag from feedback_tag where feedback_id=@Id);

delete from feedback_tag where feedback_id=@Id;

delete from user_feedback where id=@Id;
";

    const string QUERY_VERIFYING_FEEDBACK = "update user_feedback set status='verified' where id=@Id";

    /// <summary>
    /// 인증 가능한 사람만 피드백 요청 가능 (ID는 null 값으로 전송 혹은 없어도 무방)
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="dto"></param>
    /// <returns></returns>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IResult> ReportFeedback(NpgsqlDataSource dataSource, UserFeedbackDto dto)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        dto.Id = Guid.CreateVersion7();

        await dbCon.ExecuteAsync(INSERT_QUERY, dto);

        return Results.Ok();
    }

    /// <summary>
    /// 전체 통계 조회
    /// </summary>
    /// <param name="dataSource"></param>
    /// <returns></returns>
    [HttpGet("stat/status")]
    [ProducesResponseType<IEnumerable<StatusDto>>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestStatusStatics(NpgsqlDataSource dataSource)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        var response = await dbCon.QueryAsync<StatusDto>(QUERY_STATUS_STATIC);

        return Results.Ok(response);
    }

    /// <summary>
    /// 태그 통계 조회
    /// </summary>
    /// <param name="dataSource"></param>
    /// <returns></returns>
    [HttpGet("stat/tags")]
    [ProducesResponseType<IEnumerable<TagStatDto>>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestTagsStatics(NpgsqlDataSource dataSource)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        var response = await dbCon.QueryAsync<TagStatDto>(QUERY_TAG_STATIC);

        return Results.Ok(response);
    }

    /// <summary>
    /// 유저 피드백 리스트 조회
    /// </summary>
    /// <param name="dataSource"></param>
    /// <returns></returns>
    [HttpGet("feedbacks")]
    [ProducesResponseType<List<ResponseFeedbackDto>>(StatusCodes.Status200OK)]
    public async Task<IResult> RequestFeedbacks(NpgsqlDataSource dataSource)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        var response = (await dbCon.QueryAsync<ResponseFeedbackDto>(QUERY_FEEDBACKS)).ToList();

        for (int i = 0; i < response.Count; i++)
        {
            ResponseFeedbackDto res = response[i];

            res.Tags = await dbCon.QueryAsync<string>(QUERY_TAGS, res);

            response[i] = res;
        }

        return Results.Ok(response);
    }

    /// <summary>
    /// 피드백 테이블 전체 삭제
    /// </summary>
    /// <param name="dataSource"></param>
    /// <returns></returns>
    [HttpGet("deleteall")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IResult> RequestDeleteAllFeedback(NpgsqlDataSource dataSource)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        await dbCon.ExecuteAsync(QUERY_DELETE_FEEDBACK_ALL);

        return Results.Ok();
    }

    /// <summary>
    /// id를 통한 개별 삭제
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="id"></param>
    /// <returns></returns>
    [HttpGet("delete/{id}")]
    public async Task<IResult> RequestDeleteFeedback(NpgsqlDataSource dataSource, Guid id)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        await dbCon.ExecuteAsync(QUERY_DELETE_FEEDBACK_ONE, new { Id = id });

        return Results.Ok();
    }

    /// <summary>
    /// 피드백 확인
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="id"></param>
    /// <returns></returns>
    [HttpGet("verifying/{id}")]
    public async Task<IResult> VerifyingFeedback(NpgsqlDataSource dataSource, Guid id)
    {
        await using var dbCon = await dataSource.OpenConnectionAsync();

        await dbCon.ExecuteAsync(QUERY_VERIFYING_FEEDBACK, new { id });

        return Results.Ok();
    }
}
