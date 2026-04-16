using Dapper;
using Npgsql;

namespace MainServer.Initializers;

/// <summary>
/// 웹앱 확장 메서드 클래스
/// </summary>
public static class WebAppInitializer
{
    /// <summary>
    /// 웹앱 기능 등록 확장 메서드
    /// </summary>
    /// <param name="app"></param>
    public static void WebAppInit(this WebApplication app)
    {
        app.UseExceptionHandler();

        //if (app.Environment.IsDevelopment())
        {
            app.MapSwagger();
            app.UseSwaggerUI();
        }

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
    }

    /// <summary>
    /// DB 초기화 확장 메서드
    /// </summary>
    /// <param name="app"></param>
    /// <returns></returns>
    public static async Task DbInitAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();

        await using var dbCon = await scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync();

        string query =
@"create table if not exists users(
id uuid primary key default uuidv7(),
user_id varchar(255) unique not null,
email varchar(255) unique not null
);

insert into users (user_id, email) values ('admin','admin@example.com') on conflict do nothing;
";
        await dbCon.ExecuteAsync(query);
    }
}
