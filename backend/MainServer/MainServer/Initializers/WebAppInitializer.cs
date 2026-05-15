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

        app.UseCors("ExtensionPolicy");

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
user_id varchar(255) primary key,
email varchar(255) unique not null
);

create table if not exists forbiden_words(
user_id varchar(255),
f_word varchar(255),
primary key (user_id, f_word),
constraint user_id_reference foreign key (user_id) references users(user_id) on delete cascade
);
";
        await dbCon.ExecuteAsync(query);
    }
}
