using JapaneseFood.Entity;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Search
{
    public interface ISearchIndexer
    {
        /// <summary>Recomputes SearchName/SearchText for the given products (all products when null).</summary>
        Task<int> RebuildAsync(IReadOnlyCollection<long>? productIds = null, CancellationToken ct = default);
        Task<int> RebuildCategoryAsync(long categoryId, CancellationToken ct = default);
    }

    /// <summary>
    /// SearchName = "|name in every language|..." (used for relevance ranking);
    /// SearchText = names + descriptions + tags + category names + code (used for matching).
    /// </summary>
    public class SearchIndexer(DataContext db) : ISearchIndexer
    {
        public async Task<int> RebuildAsync(IReadOnlyCollection<long>? productIds = null, CancellationToken ct = default)
        {
            var query = db.Products.Include(p => p.Translations).Include(p => p.Category).AsQueryable();
            if (productIds != null) query = query.Where(p => productIds.Contains(p.Id));
            var products = await query.ToListAsync(ct);
            if (products.Count == 0) return 0;

            var categoryIds = products.Select(p => p.CategoryId).Distinct().ToList();
            var categoryNames = await db.CategoryTranslations.AsNoTracking()
                .Where(t => categoryIds.Contains(t.CategoryId))
                .Select(t => new { t.CategoryId, t.Name })
                .ToListAsync(ct);

            foreach (var p in products)
            {
                var names = new[] { p.Name }.Concat(p.Translations.Select(t => t.Name))
                    .Select(SearchNormalizer.Normalize)
                    .Where(n => n.Length > 0)
                    .Distinct()
                    .ToList();

                var text = new List<string> { p.Code, p.Tags?.Replace(',', ' ') ?? "", p.ShortDescription ?? "", p.Category?.Name ?? "" };
                text.AddRange(names);
                text.AddRange(p.Translations.Select(t => t.ShortDescription ?? ""));
                text.AddRange(categoryNames.Where(c => c.CategoryId == p.CategoryId).Select(c => c.Name));

                p.SearchName = Truncate("|" + string.Join("|", names) + "|", 1000);
                p.SearchText = Truncate(string.Join(" ", text.Select(SearchNormalizer.Normalize).Where(t => t.Length > 0).Distinct()), 4000);
            }

            await db.SaveChangesAsync(ct);
            return products.Count;
        }

        public async Task<int> RebuildCategoryAsync(long categoryId, CancellationToken ct = default)
        {
            var ids = await db.Products.Where(p => p.CategoryId == categoryId).Select(p => p.Id).ToListAsync(ct);
            return ids.Count == 0 ? 0 : await RebuildAsync(ids, ct);
        }

        private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
    }
}
