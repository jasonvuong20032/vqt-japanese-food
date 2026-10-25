using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace JapaneseFood.Service.Catalogs
{
    /// <param name="JapaneseName">The Japanese translation, shown as a decorative kanji/kana subtitle in every language.</param>
    public sealed record CategoryNode(long Id, string Name, string? JapaneseName, string? Description, int ProductCount, string? ImageUrl);

    /// <param name="ImageUrl">Cover image: the dedicated banner, else the best-selling product's first photo.</param>
    public sealed record CatalogNode(long Id, string Slug, string Name, string? JapaneseName, string? Description,
        int ProductCount, string? ImageUrl, IReadOnlyList<CategoryNode> Categories);

    public interface ICatalogService
    {
        Task<IReadOnlyList<CatalogNode>> GetTreeAsync(string lang, CancellationToken ct = default);
        void InvalidateCache();
    }

    public class CatalogService(DataContext db, IMemoryCache cache) : ICatalogService
    {
        private const string CachePrefix = "catalog-tree:";
        private static CancellationTokenSource _reset = new();

        public async Task<IReadOnlyList<CatalogNode>> GetTreeAsync(string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            if (cache.TryGetValue(CachePrefix + lang, out IReadOnlyList<CatalogNode>? cached) && cached != null)
                return cached;

            var catalogs = await db.Catalogs.AsNoTracking()
                .Where(c => !c.IsDelete && c.IsActive)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Slug,
                    c.CoverImageUrl,
                    Name = db.CatalogTranslations.Where(t => t.CatalogId == c.Id && t.LanguageCode == lang)
                        .Select(t => t.Name).FirstOrDefault() ?? c.Name,
                    Description = db.CatalogTranslations.Where(t => t.CatalogId == c.Id && t.LanguageCode == lang)
                        .Select(t => t.Description).FirstOrDefault() ?? c.Description,
                    JapaneseName = db.CatalogTranslations.Where(t => t.CatalogId == c.Id && t.LanguageCode == "ja")
                        .Select(t => t.Name).FirstOrDefault(),
                })
                .ToListAsync(ct);

            var categories = await db.Categorys.AsNoTracking()
                .Where(c => !c.IsDelete && c.IsActive)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.CatalogId,
                    Name = db.CategoryTranslations.Where(t => t.CategoryId == c.Id && t.LanguageCode == lang)
                        .Select(t => t.Name).FirstOrDefault() ?? c.Name,
                    Description = db.CategoryTranslations.Where(t => t.CategoryId == c.Id && t.LanguageCode == lang)
                        .Select(t => t.Description).FirstOrDefault() ?? c.Description,
                    JapaneseName = db.CategoryTranslations.Where(t => t.CategoryId == c.Id && t.LanguageCode == "ja")
                        .Select(t => t.Name).FirstOrDefault(),
                    ProductCount = db.Products.Count(p => p.CategoryId == c.Id && !p.IsDelete && p.IsActive),
                })
                .ToListAsync(ct);

            // One small query for cover photos: the most-sold product with an image in each category
            var covers = await db.Products.AsNoTracking()
                .Where(p => !p.IsDelete && p.IsActive)
                .Select(p => new
                {
                    p.CategoryId,
                    p.SoldCount,
                    Image = p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault(),
                })
                .Where(x => x.Image != null)
                .ToListAsync(ct);
            var coverByCategory = covers
                .GroupBy(x => x.CategoryId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.SoldCount).First());

            IReadOnlyList<CatalogNode> tree = catalogs
                .Select(c =>
                {
                    var nodes = categories
                        .Where(x => x.CatalogId == c.Id && x.ProductCount > 0)
                        .Select(x => new CategoryNode(x.Id, x.Name.Trim(), x.JapaneseName, x.Description, x.ProductCount,
                            ImageUrls.ToPublic(coverByCategory.GetValueOrDefault(x.Id)?.Image)))
                        .ToList();
                    var bestCover = categories.Where(x => x.CatalogId == c.Id)
                        .Select(x => coverByCategory.GetValueOrDefault(x.Id))
                        .Where(x => x != null)
                        .OrderByDescending(x => x!.SoldCount)
                        .FirstOrDefault();
                    return new CatalogNode(
                        c.Id,
                        string.IsNullOrEmpty(c.Slug) ? c.Id.ToString() : c.Slug,
                        c.Name.Trim(),
                        c.JapaneseName,
                        c.Description,
                        nodes.Sum(n => n.ProductCount),
                        ImageUrls.ToPublic(c.CoverImageUrl ?? bestCover?.Image),
                        nodes);
                })
                .Where(c => c.ProductCount > 0)
                .ToList();

            cache.Set(CachePrefix + lang, tree, new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10))
                .AddExpirationToken(new Microsoft.Extensions.Primitives.CancellationChangeToken(_reset.Token)));
            return tree;
        }

        public void InvalidateCache()
        {
            var old = Interlocked.Exchange(ref _reset, new CancellationTokenSource());
            old.Cancel();
            old.Dispose();
        }
    }
}
