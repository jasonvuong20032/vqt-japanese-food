using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace JapaneseFood.Service.Recommendations
{
    public sealed record BestSeller(ProductCard Product, int UnitsSold);

    public interface IRecommendationService
    {
        /// <summary>
        /// Products ranked by units sold in recent non-cancelled orders; topped up with all-time
        /// <c>SoldCount</c> and then views when recent sales are thin, so the list is never empty.
        /// </summary>
        Task<IReadOnlyList<BestSeller>> GetBestSellersAsync(long? catalogId, long? categoryId, int limit, string lang, CancellationToken ct = default);

        /// <summary>Products that most often appear in the same order as <paramref name="productId"/>.</summary>
        Task<IReadOnlyList<ProductCard>> GetFrequentlyBoughtTogetherAsync(long productId, int limit, string lang, CancellationToken ct = default);
    }

    public class RecommendationService(DataContext db, IProductService products, IMemoryCache cache, TimeProvider clock)
        : IRecommendationService
    {
        public const int RecentWindowDays = 30;
        private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

        public async Task<IReadOnlyList<BestSeller>> GetBestSellersAsync(long? catalogId, long? categoryId, int limit, string lang, CancellationToken ct = default)
        {
            limit = Math.Clamp(limit, 1, 50);
            var key = $"bestsellers:{catalogId}:{categoryId}:{limit}";

            var ranked = await cache.GetOrCreateAsync(key, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                return await RankBestSellersAsync(catalogId, categoryId, limit, ct);
            }) ?? [];

            var cards = await products.GetCardsAsync(ranked.Select(r => r.ProductId).ToList(), lang, ct);
            var sold = ranked.ToDictionary(r => r.ProductId, r => r.Units);
            return cards.Select(c => new BestSeller(c, sold.GetValueOrDefault(c.Id))).ToList();
        }

        public async Task<IReadOnlyList<ProductCard>> GetFrequentlyBoughtTogetherAsync(long productId, int limit, string lang, CancellationToken ct = default)
        {
            limit = Math.Clamp(limit, 1, 20);
            var key = $"fbt:{productId}:{limit}";

            var ids = await cache.GetOrCreateAsync(key, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;

                var orderIds = db.OrderDetails.Where(d => d.ProductId == productId).Select(d => d.OrderId);
                var together = await db.OrderDetails.AsNoTracking()
                    .Where(d => orderIds.Contains(d.OrderId) && d.ProductId != productId)
                    .Join(ProductService.ActiveProducts(db), d => d.ProductId, p => p.Id, (d, p) => d)
                    .GroupBy(d => d.ProductId)
                    .Select(g => new { ProductId = g.Key, Orders = g.Select(x => x.OrderId).Distinct().Count() })
                    .OrderByDescending(x => x.Orders)
                    .Take(limit)
                    .Select(x => x.ProductId)
                    .ToListAsync(ct);

                if (together.Count < limit)
                {
                    // Not enough co-purchase data: fill with best sellers from the same category
                    var categoryId = await db.Products.Where(p => p.Id == productId).Select(p => (long?)p.CategoryId).FirstOrDefaultAsync(ct);
                    var fill = await RankBestSellersAsync(null, categoryId, limit + together.Count + 1, ct);
                    together.AddRange(fill.Select(f => f.ProductId).Where(id => id != productId && !together.Contains(id)).Take(limit - together.Count));
                }

                return together;
            }) ?? [];

            return await products.GetCardsAsync(ids, lang, ct);
        }

        internal async Task<List<(long ProductId, int Units)>> RankBestSellersAsync(long? catalogId, long? categoryId, int limit, CancellationToken ct)
        {
            var since = clock.GetLocalNow().DateTime.AddDays(-RecentWindowDays);

            var candidates = ProductService.ActiveProducts(db).Where(p => p.IsAvailable && p.Quantity > 0);
            if (catalogId.HasValue) candidates = candidates.Where(p => p.Category.CatalogId == catalogId.Value);
            if (categoryId.HasValue) candidates = candidates.Where(p => p.CategoryId == categoryId.Value);

            var validOrders = db.Orders.Where(o => !o.IsDelete
                && o.Status != (int)EnumCommons.OrderStatus.Cancelled
                && o.Status != (int)EnumCommons.OrderStatus.Refunded
                && o.CreatedAt >= since);

            var recent = await db.OrderDetails.AsNoTracking()
                .Join(validOrders, d => d.OrderId, o => o.Id, (d, o) => d)
                .Join(candidates, d => d.ProductId, p => p.Id, (d, p) => d)
                .GroupBy(d => d.ProductId)
                .Select(g => new { ProductId = g.Key, Units = g.Sum(x => x.Quantity) })
                .OrderByDescending(x => x.Units)
                .Take(limit)
                .ToListAsync(ct);

            var result = recent.Select(r => (r.ProductId, r.Units)).ToList();
            if (result.Count >= limit) return result;

            var taken = result.Select(r => r.ProductId).ToList();
            var allTime = await candidates
                .Where(p => !taken.Contains(p.Id))
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => db.ProductViews.Where(v => v.ProductId == p.Id).Sum(v => (int?)v.View) ?? 0)
                .ThenByDescending(p => p.CreatedAt)
                .Take(limit - result.Count)
                .Select(p => new { p.Id, p.SoldCount })
                .ToListAsync(ct);

            result.AddRange(allTime.Select(p => (p.Id, p.SoldCount)));
            return result;
        }
    }
}
