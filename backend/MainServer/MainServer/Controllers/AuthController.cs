using Dapper;
using MainServer.Dtos.FromClient;
using MainServer.Dtos.FromServer;
using MainServer.Infos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Security.Claims;

namespace MainServer.Controllers;

/// <summary>
/// Authentication Controller
/// </summary>
[ApiController]
[Route("/auth")]
public class AuthController : ControllerBase
{
    const string QUERY_INSERT_USER = "insert into users user_id, email values (@UserId, @Email)";
    const string QUERY_CONFLICT_CHECK = "select exists (select 1 from users where user_id=@UserId)";
    const string QUERY_SELECT_USER = "select user_id, email from users where user_id=@UserId";

    /// <summary>
    /// 구글 계정으로 가입 API
    /// </summary>
    /// <param name="dataSource"></param>
    /// <param name="googleInfo"></param>
    /// <param name="credentials"></param>
    /// <param name="handler"></param>
    /// <param name="configurationManager"></param>
    /// <param name="authToken"></param>
    /// <returns></returns>
    [HttpPost("google-signup")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<string>(StatusCodes.Status200OK)]
    public async Task<IResult> GoogleSignup
        (NpgsqlDataSource dataSource, IOptions<GoogleInfo> googleInfo, SigningCredentials credentials, JsonWebTokenHandler handler, 
        ConfigurationManager<OpenIdConnectConfiguration> configurationManager, GoogleOAuthTokenDto authToken)
    {
        TokenValidationParameters param = new()
        {
            ValidateIssuer = true,
            ValidIssuer = googleInfo.Value.Issuer,
            ValidateAudience = true,
            ValidAudience = googleInfo.Value.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ConfigurationManager = configurationManager
        };

        var res = await handler.ValidateTokenAsync(authToken.Token, param);

        if (res.IsValid == false)
            return Results.Unauthorized();

        string userId = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? string.Empty;
        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? string.Empty;

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
            return Results.Unauthorized();

        await using var dbCon = await dataSource.OpenConnectionAsync();
        
        bool conflict = await dbCon.QueryFirstAsync<bool>(QUERY_CONFLICT_CHECK, new { userId });

        if (conflict == true)
            return Results.Conflict();

        await dbCon.ExecuteAsync(QUERY_INSERT_USER, new { email });

        return Results.Ok("Signup Success");
    }

    /// <summary>
    /// 구글 계정으로 로그인 API
    /// </summary>
    /// <param name="configurationManager"></param>
    /// <param name="serverInfo"></param>
    /// <param name="googleInfo"></param>
    /// <param name="handler"></param>
    /// <param name="dataSource"></param>
    /// <param name="credentials"></param>
    /// <param name="authToken"></param>
    /// <returns></returns>
    [HttpPost("google-signin")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<AuthOkTokenDto>(StatusCodes.Status200OK)]
    public async Task<IResult> GoogleSignin
        (ConfigurationManager<OpenIdConnectConfiguration> configurationManager, IOptions<ServerInfo> serverInfo, IOptions<GoogleInfo> googleInfo,
         JsonWebTokenHandler handler, NpgsqlDataSource dataSource, SigningCredentials credentials, GoogleOAuthTokenDto authToken)
    {
        TokenValidationParameters param = new()
        {
            ValidateIssuer = true,
            ValidIssuer = googleInfo.Value.Issuer,
            ValidateAudience = true,
            ValidAudience = googleInfo.Value.Audience,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ConfigurationManager = configurationManager
        };

        var res = await handler.ValidateTokenAsync(authToken.Token, param);

        if (res.IsValid == false)
            return Results.Unauthorized();

        string userId = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? string.Empty;
        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? string.Empty;

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
            return Results.Unauthorized();

        await using var dbCon = await dataSource.OpenConnectionAsync();

        UserDto? user = await dbCon.QueryFirstOrDefaultAsync<UserDto>(QUERY_SELECT_USER, new { userId });

        if (user.HasValue == false)
            return Results.Unauthorized();

        if (user.Value.UserId != userId || user.Value.Email != email)
            return Results.Unauthorized();

        SecurityTokenDescriptor descriptor = new()
        {
            Subject = new([new(JwtRegisteredClaimNames.Sub, userId), new(JwtRegisteredClaimNames.Email, email)]),
            Issuer = serverInfo.Value.Issuer,
            Audience = serverInfo.Value.Audience,
            Expires = DateTime.Now.AddMinutes(serverInfo.Value.ExpireHours),
            SigningCredentials = credentials
        };

        string tokenString = handler.CreateToken(descriptor);

        AuthOkTokenDto responseToken = new()
        {
            Token = tokenString
        };

        return Results.Ok(responseToken);
    }

    /// <summary>
    /// 인증 Audience 없을 때 일단 검증
    /// </summary>
    /// <param name="credentials"></param>
    /// <param name="serverInfo"></param>
    /// <param name="googleInfo"></param>
    /// <param name="handler"></param>
    /// <param name="configurationManager"></param>
    /// <param name="authToken"></param>
    /// <returns></returns>
    [HttpPost("google-tokentest")]
    public async Task<IResult> TestTokenValidate
        (SigningCredentials credentials, IOptions<ServerInfo> serverInfo, IOptions<GoogleInfo> googleInfo, JsonWebTokenHandler handler, 
        ConfigurationManager<OpenIdConnectConfiguration> configurationManager, GoogleOAuthTokenDto authToken)
    {
        Console.WriteLine(googleInfo.Value.Issuer);

        TokenValidationParameters param = new()
        {
            ValidateIssuer = true,
            ValidIssuer = googleInfo.Value.Issuer,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ConfigurationManager = configurationManager
        };

        var res = await handler.ValidateTokenAsync(authToken.Token, param);

        if (res.IsValid == false)
            return Results.Unauthorized();

        string userId = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? string.Empty;
        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? string.Empty;

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
            return Results.Unauthorized();

        SecurityTokenDescriptor descriptor = new()
        {
            Subject = new([new(JwtRegisteredClaimNames.Sub, userId), new(JwtRegisteredClaimNames.Email, email)]),
            Issuer = serverInfo.Value.Issuer,
            Audience = serverInfo.Value.Audience,
            Expires = DateTime.Now.AddMinutes(serverInfo.Value.ExpireHours),
            SigningCredentials = credentials
        };

        string token = handler.CreateToken(descriptor);

        return Results.Ok(new { Token = token });
    }

    /// <summary>
    /// 인증 테스트
    /// </summary>
    /// <returns></returns>
    [Authorize]
    [HttpGet("test")]
    [ProducesResponseType<string>(StatusCodes.Status200OK)]
    public IResult AuthenticationTest()
    {
        string userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? string.Empty;
        string email = User.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty;

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
            return Results.Ok("뭔가 안 됨");

        return Results.Ok($"{email}");
    }
}