using JapaneseFood.Service.Common;
using JapaneseFood.Service.Settings;
using System.Text.Json;

namespace JapaneseFood.Service.Content
{
    /// <summary>
    /// Rich page content (e.g. the "Our story" page) stored as one JSON document per language in StoreSettings
    /// under "Content.{page}.{lang}". The frontend owns the layout; the JSON only carries words and images.
    /// </summary>
    public interface IStoreContentService
    {
        /// <summary>Raw JSON for the page in <paramref name="lang"/>, falling back to Vietnamese; null when missing.</summary>
        Task<string?> GetAsync(string page, string lang, CancellationToken ct = default);
        Task SetAsync(string page, string lang, string json, CancellationToken ct = default);
    }

    public class StoreContentService(IStoreSettingsService settings) : IStoreContentService
    {
        public static readonly IReadOnlyList<string> Pages = ["about"];

        public async Task<string?> GetAsync(string page, string lang, CancellationToken ct = default)
        {
            if (!Pages.Contains(page)) return null;
            var all = await settings.GetAllAsync(ct);
            return all.GetValueOrDefault(Key(page, Languages.Normalize(lang)))
                   ?? all.GetValueOrDefault(Key(page, Languages.Default));
        }

        public async Task SetAsync(string page, string lang, string json, CancellationToken ct = default)
        {
            if (!Pages.Contains(page)) throw AppException.BadRequest("unknown_page", "Unknown content page.");
            try
            {
                using var _ = JsonDocument.Parse(json);
            }
            catch (JsonException)
            {
                throw AppException.BadRequest("invalid_json", "Content must be valid JSON.");
            }
            await settings.SetAsync(new Dictionary<string, string> { [Key(page, Languages.Normalize(lang))] = json }, ct);
        }

        private static string Key(string page, string lang) => $"Content.{page}.{lang}";
    }
}
