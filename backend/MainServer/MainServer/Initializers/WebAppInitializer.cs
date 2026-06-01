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

        app.UseCors("ExtensionPolicy");

        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        app.UseStaticFiles();

        app.MapGet("/index", async (HttpContext context) =>
        {
            context.Response.ContentType = "text/html";
            await context.Response.SendFileAsync("wwwroot/index.html");
        });
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

create table if not exists user_feedback(
id uuid primary key default uuidv7(),
video_url text not null,
plain_text text not null,
converted_text text,
feedback text,
created_at timestamp with time zone default current_timestamp,
status varchar(255) default 'unverified'
);

create table if not exists tags(
tag varchar(255) primary key,
count int default 1
);

create table if not exists feedback_tag(
feedback_id uuid,
tag varchar(255),

constraint ref_feedback_id foreign key (feedback_id) references user_feedback(id),
constraint ref_tag foreign key (tag) references tags(tag),
constraint p_key_feedback_tag primary key (feedback_id, tag)
);

create table if not exists cached_comments(
plain_text text primary key,
refined_text text,
is_toxic boolean not null
);
";
        await dbCon.ExecuteAsync(query);
    }
}
