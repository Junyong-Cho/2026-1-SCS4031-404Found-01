using MainServer.ExceptionHandlers;
using MainServer.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Reflection;

var builder = WebApplication.CreateBuilder();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.Configure<GoogleInfoSettings>(builder.Configuration.GetSection("Google"));
builder.Services.Configure<TokenInfoSettings>(builder.Configuration.GetSection("Token"));
builder.Services.Configure<SecretInfoSettings>(builder.Configuration.GetSection("Secret"));

builder.Services.AddSingleton<SymmetricKeySettings>();

builder.Services.AddSingleton<JsonWebTokenHandler>();
builder.Services.AddSingleton(new ConfigurationManager<OpenIdConnectConfiguration>("https://account.google.com/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever()));

builder.Services.AddSingleton<SigningCredentials>(provider =>
{
    var setting = provider.GetRequiredService<SymmetricKeySettings>();

    return new(setting.SymmetricKey, SecurityAlgorithms.HmacSha256);
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new()
        {
            ValidateIssuer = true,
            ValidIssuer = "https://account.google.com",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Google:ClientId"],
            ValidateLifetime = true
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddControllers();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
    builder.Services.AddSwaggerGen(options =>
    {
        options.IncludeXmlComments(Path.Join(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml"));
    });
}

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();

    app.MapSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

app.Run();