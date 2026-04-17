using MainServer.Dtos.FromServer;
using MainServer.Initializers;
using System.Net;

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder();

builder.WebAppBuilderSet();

var app = builder.Build();

app.WebAppInit();
await app.DbInitAsync();

app.MapGet("/", () => "Index Page");

//_ = Task.Run(async () =>
//{
//    Console.ReadLine();
//    HttpClient client = new();

//    while (true)
//    {
//        Console.Write("Token >> ");
//        string? token = Console.ReadLine();

//        if (string.IsNullOrEmpty(token))
//        {
//            continue;
//        }

//        var res = await client.PostAsJsonAsync("http://localhost:8080/test/google-tokentest", new { Token = token });

//        Console.WriteLine(res.StatusCode);

//        if (res.StatusCode != HttpStatusCode.OK)
//            continue;

//        AuthOkTokenDto dto = await res.Content.ReadFromJsonAsync<AuthOkTokenDto>();

//        client.DefaultRequestHeaders.Authorization = new("Bearer", dto.Token);

//        res = await client.GetAsync("http://localhost:8080/test/test");

//        Console.WriteLine(res.StatusCode);

//        Console.WriteLine(await res.Content.ReadAsStringAsync());
//    }
//});

await app.RunAsync();