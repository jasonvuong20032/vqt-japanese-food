using JapaneseFood.Service.Common;
using System.Security.Claims;

namespace JapaneseFood.Api.Infrastructure
{
    public static class HttpContextExtensions
    {
        /// <summary>?lang=ja wins, then the first Accept-Language entry, then Vietnamese.</summary>
        public static string GetLanguage(this HttpContext context)
        {
            var fromQuery = context.Request.Query["lang"].ToString();
            if (!string.IsNullOrWhiteSpace(fromQuery)) return Languages.Normalize(fromQuery);

            var header = context.Request.Headers.AcceptLanguage.ToString();
            var first = header.Split(',', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Split(';')[0];
            return Languages.Normalize(first);
        }

        public static long? GetUserId(this ClaimsPrincipal user)
            => long.TryParse(user.FindFirstValue("sub"), out var id) ? id : null;

        public static long RequireUserId(this ClaimsPrincipal user)
            => user.GetUserId() ?? throw AppException.Unauthorized("unauthorized", "Please sign in.");

        public static string? GetEmail(this ClaimsPrincipal user) => user.FindFirstValue("email");

        /// <summary>Audit value for CreatedBy/UpdatedBy columns.</summary>
        public static string GetActor(this ClaimsPrincipal user) => user.GetEmail() ?? user.GetUserId()?.ToString() ?? "anonymous";
    }
}
