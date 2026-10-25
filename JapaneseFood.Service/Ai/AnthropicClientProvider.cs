using Anthropic;
using Microsoft.Extensions.Configuration;

namespace JapaneseFood.Service.Ai
{
    /// <summary>
    /// One Claude API client for the app (AI translation in the back office). The key comes from
    /// "Anthropic:ApiKey" (user-secrets) or ANTHROPIC_API_KEY; without one, AI features report themselves
    /// unavailable instead of failing at startup.
    /// </summary>
    public sealed class AnthropicClientProvider
    {
        public AnthropicClientProvider(IConfiguration configuration)
        {
            var apiKey = configuration["Anthropic:ApiKey"];
            if (!string.IsNullOrWhiteSpace(apiKey)) Client = new AnthropicClient { ApiKey = apiKey };
            else if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"))) Client = new AnthropicClient();
        }

        public AnthropicClient? Client { get; }

        public bool IsConfigured => Client is not null;

        /// <summary>Beta header for the server-side refusal fallback; "default" lets the API pick the model per refusal category.</summary>
        public const string FallbackBeta = "server-side-fallback-2026-07-01";
    }
}
