using Microsoft.AspNetCore.OutputCaching;
using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

namespace JapaneseFood.Api.Infrastructure
{
    /// <summary>
    /// Server-side cache for anonymous-safe catalog reads (product lists, catalog tree, policies).
    /// Unlike the default policy it also caches for signed-in shoppers, because these responses
    /// never depend on who is asking — only on the query string and language.
    /// </summary>
    public sealed class PublicCachePolicy : IOutputCachePolicy
    {
        public const string Name = "public";
        public const string Tag = "catalog";

        public static TimeSpan Duration { get; set; } = TimeSpan.FromSeconds(60);

        ValueTask IOutputCachePolicy.CacheRequestAsync(OutputCacheContext context, CancellationToken ct)
        {
            var method = context.HttpContext.Request.Method;
            var cacheable = HttpMethods.IsGet(method) || HttpMethods.IsHead(method);

            context.EnableOutputCaching = true;
            context.AllowCacheLookup = cacheable;
            context.AllowCacheStorage = cacheable;
            // No request coalescing: with locking, identical requests wait on the first one and share its outcome,
            // so when that first client disconnects (React StrictMode aborts every first fetch in dev, shoppers
            // navigate away) its cancelled query surfaces as a 500 for everyone waiting. A catalog this size can
            // afford the occasional duplicate query on a cache miss.
            context.AllowLocking = false;
            context.CacheVaryByRules.QueryKeys = "*";
            context.CacheVaryByRules.HeaderNames = new StringValues(HeaderNames.AcceptLanguage);
            context.ResponseExpirationTimeSpan = Duration;
            context.Tags.Add(Tag);
            return ValueTask.CompletedTask;
        }

        ValueTask IOutputCachePolicy.ServeFromCacheAsync(OutputCacheContext context, CancellationToken ct) => ValueTask.CompletedTask;

        ValueTask IOutputCachePolicy.ServeResponseAsync(OutputCacheContext context, CancellationToken ct)
        {
            var response = context.HttpContext.Response;
            if (response.StatusCode != StatusCodes.Status200OK || !StringValues.IsNullOrEmpty(response.Headers.SetCookie))
                context.AllowCacheStorage = false;
            return ValueTask.CompletedTask;
        }
    }
}
