using MainServer.Settings;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

namespace MainServer.Controllers;

/// <summary>
/// Authentication Controller
/// </summary>
[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// 구글 ID로 로그인
    /// </summary>
    /// <param name="googleInfoOpt"></param>
    /// <param name="tokenInfoOpt"></param>
    /// <param name="credentials"></param>
    /// <param name="handler"></param>
    /// <param name="configurationManager"></param>
    /// <param name="token">요청 바디</param>
    /// <returns></returns>
    [HttpPost("google-signin")]
    [ProducesResponseType(typeof(TempResponseToken), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> GoogleSignin
        (IOptions<GoogleInfoSettings> googleInfoOpt, IOptions<TokenInfoSettings> tokenInfoOpt, SigningCredentials credentials, JsonWebTokenHandler handler, ConfigurationManager<OpenIdConnectConfiguration> configurationManager, GoogleToken token)
    {
        TokenValidationParameters param = new()
        {
            ValidateIssuer = true,
            ValidIssuer = "https://account.google.com",
            ValidateAudience = true,
            ValidAudience = googleInfoOpt.Value.ClientId,
            ValidateLifetime = true,
            ConfigurationManager = configurationManager
        };

        var res = await handler.ValidateTokenAsync(token.Token, param);

        if (res.IsValid == false)
            return Results.Unauthorized();

        string userUnique = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)!.Value;

        Claim[] claims = [new(JwtRegisteredClaimNames.Sub, userUnique), new(JwtRegisteredClaimNames.Email, email)];

        TokenInfoSettings tokenInfo = tokenInfoOpt.Value;

        SecurityTokenDescriptor tokenDescriptor = new()
        {
            Subject = new(claims),
            Issuer = tokenInfo.Issuer,
            Audience = tokenInfo.Audience,
            Expires = DateTime.Now.AddHours(tokenInfo.ExpireHours),
            SigningCredentials = credentials
        };

        string tokenString = handler.CreateToken(tokenDescriptor);

        return Results.Ok(new TempResponseToken(tokenString));
    }

    /// <summary>
    /// 구글 ID로 회원가입
    /// </summary>
    /// <param name="googleInfoOpt"></param>
    /// <param name="configurationManager"></param>
    /// <param name="handler"></param>
    /// <param name="token"></param>
    /// <returns></returns>
    [HttpPost("google-signup")]
    [ProducesResponseType(typeof(SignupComplete), StatusCodes.Status200OK)]
    public async Task<IResult> GoogleSignup
        (IOptions<GoogleInfoSettings> googleInfoOpt, ConfigurationManager<OpenIdConnectConfiguration> configurationManager, JsonWebTokenHandler handler, GoogleToken token)
    {
        TokenValidationParameters param = new()
        {
            ValidateIssuer = true,
            ValidIssuer = "https://account.google.com",
            ValidateAudience = true,
            ValidAudience = googleInfoOpt.Value.ClientId,
            ConfigurationManager = configurationManager
        };

        var res = await handler.ValidateTokenAsync(token.Token, param);
        
        string userUnique = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)!.Value;

        return Results.Ok(new SignupComplete(userUnique, email));
    }
}

/// <summary>
/// 로그인 요청 토큰
/// </summary>
/// <param name="Token"></param>
public record GoogleToken(string Token);

/// <summary>
/// 임시 로그인 토큰 반환 DTO
/// </summary>
/// <param name="Token"></param>
public record TempResponseToken(string Token);

/// <summary>
/// 임시 회원가입 반환 DTO
/// </summary>
/// <param name="UserUnique"></param>
/// <param name="Email"></param>
public record SignupComplete(string UserUnique, string Email);