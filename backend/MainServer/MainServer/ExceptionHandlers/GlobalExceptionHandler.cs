using Microsoft.AspNetCore.Diagnostics;

namespace MainServer.ExceptionHandlers;

/// <summary>
/// 글로벌 예외처리
/// </summary>
public class GlobalExceptionHandler : IExceptionHandler
{
    /// <summary>
    /// 글로벌 예외처리
    /// </summary>
    /// <param name="httpContext"></param>
    /// <param name="exception"></param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        Console.WriteLine(exception.Message);

        await httpContext.Response.WriteAsJsonAsync(new
        {
            StatusCodes.Status500InternalServerError,
            Message = "Internal Server Error",
            Detail = exception.Message
        });

        return true;
    }
}
