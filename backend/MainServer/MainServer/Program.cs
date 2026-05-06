using MainServer.Initializers;

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder();

builder.WebAppBuilderSet();

var app = builder.Build();

app.WebAppInit();
await app.DbInitAsync();

app.MapGet("/", () => "Index Page");
await app.RunAsync();