using JapaneseFood.Service.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace JapaneseFood.Api.Infrastructure
{
    /// <summary>
    /// Turns <see cref="AppException"/> into ProblemDetails with a stable <c>code</c> the frontend translates.
    /// Anything else becomes a generic 500 (details are logged, never returned).
    /// </summary>
    public sealed class AppExceptionHandler(IProblemDetailsService problemDetails, ILogger<AppExceptionHandler> logger) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
        {
            ProblemDetails problem;
            if (exception is AppException app)
            {
                problem = new ProblemDetails { Status = app.StatusCode, Title = app.Message };
                problem.Extensions["code"] = app.Code;
                if (app.Details != null) problem.Extensions["details"] = app.Details;
            }
            else if (context.RequestAborted.IsCancellationRequested)
            {
                // Client went away; nothing useful to send. Whatever was running got cancelled, which SqlClient
                // reports as a SqlException ("Operation cancelled by user") rather than OperationCanceledException.
                logger.LogDebug(exception, "Request aborted by the client on {Method} {Path}", context.Request.Method, context.Request.Path);
                context.Response.StatusCode = 499;
                return true;
            }
            else
            {
                logger.LogError(exception, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
                problem = new ProblemDetails { Status = 500, Title = "Something went wrong. Please try again." };
                problem.Extensions["code"] = "server_error";
            }

            context.Response.StatusCode = problem.Status!.Value;
            return await problemDetails.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = problem,
                Exception = exception,
            });
        }
    }
}
