using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace JapaneseFood.Service.Content
{
    /// <param name="Credit">"Creator · License · source URL" as recorded when the photo was imported.</param>
    public sealed record PhotoCredit(string Name, string? Slug, string ImageUrl, string Credit);

    public interface ICreditsService
    {
        /// <summary>Attribution for every openly licensed photo on the site (required by CC BY).</summary>
        Task<IReadOnlyList<PhotoCredit>> GetAsync(string lang, CancellationToken ct = default);
    }

    public class CreditsService(DataContext db, IStoreContentService content) : ICreditsService
    {
        public const string Prefix = "Photo: ";

        public async Task<IReadOnlyList<PhotoCredit>> GetAsync(string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            var products = await db.Images.AsNoTracking()
                .Where(i => i.Title.StartsWith(Prefix) && !i.Product.IsDelete && i.Product.IsActive)
                .OrderBy(i => i.Product.Name)
                .Select(i => new
                {
                    Name = i.Product.Translations.Where(t => t.LanguageCode == lang).Select(t => t.Name).FirstOrDefault() ?? i.Product.Name,
                    i.Product.Slug,
                    i.ImageUrl,
                    i.Title,
                })
                .ToListAsync(ct);

            var list = products
                .Select(p => new PhotoCredit(p.Name, p.Slug, ImageUrls.ToPublic(p.ImageUrl)!, p.Title[Prefix.Length..]))
                .ToList();

            // Photos used on the "Our story" page carry their credit inside the page JSON
            var about = await content.GetAsync("about", lang, ct);
            if (about != null && JsonNode.Parse(about) is JsonObject page)
            {
                var seen = new HashSet<string>();
                foreach (var section in page.Select(kv => kv.Value).OfType<JsonObject>())
                {
                    var image = section["image"]?.GetValue<string>();
                    var credit = section["imageCredit"]?.GetValue<string>();
                    if (image == null || credit == null || !seen.Add(image)) continue;
                    var title = section["title"]?.GetValue<string>() ?? "About";
                    list.Add(new PhotoCredit(title, null, image, credit));
                }
            }
            return list;
        }
    }
}
