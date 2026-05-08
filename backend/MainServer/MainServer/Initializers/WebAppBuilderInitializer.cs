using MainServer.ExceptionHandlers;
using MainServer.Infos;
using MainServer.Singletons;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Reflection;

namespace MainServer.Initializers;

/// <summary>
/// 웹앱 빌더 확장 메서드 클래스
/// </summary>
public static class WebAppBuilderInitializer
{

    /// <summary>
    /// 웹앱 빌더 설정 확장 메서드
    /// </summary>
    /// <param name="builder"></param>
    public static void WebAppBuilderSet(this WebApplicationBuilder builder)
    {
        builder.Configuration.AddEnvironmentVariables();
        builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
        builder.Services.AddProblemDetails();
        builder.Services.AddMemoryCache();
        builder.Services.AddSingleton<AccessTokenDisposeChecker>();

        DbConnectionSet(builder);

        //if (builder.Environment.IsDevelopment())
        {
            SwaggerSet(builder);
        }

        AuthenticationSet(builder);
        Configure(builder);

        builder.Services.AddControllers();

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("ExtensionPolicy", policy =>
            {
                policy.AllowAnyOrigin()//WithOrigins(builder.Configuration["ExtensionAddress"]!)
                .AllowAnyHeader()//.WithHeaders("Authorization")
                //.WithHeaders("Content-type")
                .AllowAnyMethod();
            });
        });
    }

    /// <summary>
    /// Db 연결 설정
    /// </summary>
    /// <param name="builder"></param>
    static void DbConnectionSet(WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton(NpgsqlDataSource.Create(builder.Configuration.GetConnectionString("Default")!));
    }

    /// <summary>
    /// 스웨거 설정
    /// </summary>
    /// <param name="builder"></param>
    static void SwaggerSet(WebApplicationBuilder builder)
    {
        builder.Services.AddSwaggerGen(options =>
        options.IncludeXmlComments(Path.Join(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml")));
    }

    /// <summary>
    /// 인증 설정
    /// </summary>
    /// <param name="builder"></param>
    static void AuthenticationSet(WebApplicationBuilder builder)
    {
        SymmetricSecurityKey key = new(Convert.FromBase64String(builder.Configuration["SecretKey"]!));

        builder.Services.AddSingleton(new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        builder.Services.AddSingleton<JsonWebTokenHandler>();

        builder.Services.AddSingleton(new ConfigurationManager<OpenIdConnectConfiguration>("https://accounts.google.com/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever()));

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new()
                {
                    ValidateIssuer = true,
                    ValidIssuer = builder.Configuration["ServerInfo:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = builder.Configuration["ServerInfo:Audience"],
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key
                };

                options.Events.OnTokenValidated = context =>
                {
                    string jti = context.Principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value ?? string.Empty;

                    if (string.IsNullOrEmpty(jti))
                    {
                        context.Fail("Invalid Token");
                        return Task.CompletedTask;
                    }

                    var checker = context.HttpContext.RequestServices.GetRequiredService<AccessTokenDisposeChecker>();

                    if (checker.CheckDisposed(jti) == true)
                        context.Fail("Invalid Token");

                    return Task.CompletedTask;
                };
            });

        builder.Services.AddAuthorization();
    }

    /// <summary>
    /// 환경 변수 설정
    /// </summary>
    /// <param name="builder"></param>
    static void Configure(WebApplicationBuilder builder)
    {
        builder.Services.Configure<GoogleInfo>(builder.Configuration.GetSection("GoogleInfo"));
        builder.Services.Configure<ServerInfo>(builder.Configuration.GetSection("ServerInfo"));
        builder.Services.Configure<AIServerInfo>(builder.Configuration.GetSection("AIServerInfo"));
    }
}
