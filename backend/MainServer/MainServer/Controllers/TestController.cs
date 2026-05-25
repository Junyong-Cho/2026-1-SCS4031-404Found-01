//using MainServer.Dtos.FromClient;
//using MainServer.Infos;
//using MainServer.Singletons;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.Extensions.Options;
//using Microsoft.IdentityModel.JsonWebTokens;
//using Microsoft.IdentityModel.Protocols;
//using Microsoft.IdentityModel.Protocols.OpenIdConnect;
//using Microsoft.IdentityModel.Tokens;
//using System.Security.Claims;

//namespace MainServer.Controllers;

///// <summary>
///// api 테스트용
///// </summary>
//[ApiController]
//[Route("/test")]
//public class TestController : ControllerBase
//{
//    /// <summary>
//    /// 인증 Audience 없을 때 일단 검증
//    /// </summary>
//    /// <param name="credentials"></param>
//    /// <param name="serverInfo"></param>
//    /// <param name="googleInfo"></param>
//    /// <param name="handler"></param>
//    /// <param name="configurationManager"></param>
//    /// <param name="authToken"></param>
//    /// <returns></returns>
//    [HttpPost("google-tokentest")]
//    public async Task<IResult> TestTokenValidate
//        (SigningCredentials credentials, IOptions<ServerInfo> serverInfo, IOptions<GoogleInfo> googleInfo, JsonWebTokenHandler handler,
//        ConfigurationManager<OpenIdConnectConfiguration> configurationManager, GoogleOAuthTokenDto authToken)
//    {
//        TokenValidationParameters param = new()
//        {
//            ValidateIssuer = true,
//            ValidIssuer = googleInfo.Value.Issuer,
//            ValidateAudience = false,
//            ValidateLifetime = true,
//            ValidateIssuerSigningKey = true,
//            ConfigurationManager = configurationManager
//        };

//        var res = await handler.ValidateTokenAsync(authToken.Token, param);

//        if (res.IsValid == false)
//            return Results.Unauthorized();

//        string userId = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? string.Empty;
//        string email = res.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? string.Empty;

//        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
//            return Results.Unauthorized();

//        SecurityTokenDescriptor descriptor = new()
//        {
//            Subject = new([new(JwtRegisteredClaimNames.Sub, userId), 
//                    new(JwtRegisteredClaimNames.Email, email),
//                    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())]
//                ),
//            Issuer = serverInfo.Value.Issuer,
//            Audience = serverInfo.Value.Audience,
//            Expires = DateTime.Now.AddHours(serverInfo.Value.ExpireHours),
//            SigningCredentials = credentials
//        };

//        string token = handler.CreateToken(descriptor);

//        return Results.Ok(new { Token = token });
//    }

//    /// <summary>
//    /// 인증 테스트
//    /// </summary>
//    /// <returns></returns>
//    [Authorize]
//    [HttpGet("test")]
//    [ProducesResponseType<string>(StatusCodes.Status200OK)]
//    public IResult AuthenticationTest()
//    {
//        string userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? string.Empty;
//        string email = User.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty;

//        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
//            return Results.Ok("뭔가 안 됨");

//        return Results.Ok($"{email}");
//    }

//    /// <summary>
//    /// 토큰 폐기
//    /// </summary>
//    /// <param name="checker"></param>
//    /// <returns></returns>
//    [Authorize]
//    [HttpGet("logout")]
//    public IResult Logout(AccessTokenDisposeChecker checker)
//    {
//        string jti = User.FindFirstValue(JwtRegisteredClaimNames.Jti)!;
//        string exp = User.FindFirstValue(JwtRegisteredClaimNames.Exp)!;

//        DateTimeOffset expires = DateTimeOffset.FromUnixTimeSeconds(long.Parse(exp));

//        checker.DisposeToken(jti, expires);

//        return Results.Ok();
//    }
//}
