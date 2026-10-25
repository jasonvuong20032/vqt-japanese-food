using JapaneseFood.Entity;
using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Products
{
    public interface IProductService
    {
        Task<PagedResult<ProductCard>> SearchAsync(ProductQuery query, string lang, CancellationToken ct = default);
        Task<ProductDetail?> GetAsync(string idOrSlug, string lang, CancellationToken ct = default);
        /// <summary>Cards for the given ids, in the same order; missing / inactive ids are skipped.</summary>
        Task<IReadOnlyList<ProductCard>> GetCardsAsync(IReadOnlyList<long> ids, string lang, CancellationToken ct = default);
        Task RecordViewAsync(long productId, CancellationToken ct = default);
    }

    public class ProductService(DataContext db) : IProductService
    {
        public async Task<PagedResult<ProductCard>> SearchAsync(ProductQuery q, string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            var (page, pageSize) = Paging.Normalize(q.Page, q.PageSize);

            var query = ActiveProducts(db);

            if (q.CatalogId.HasValue)
                query = query.Where(p => p.Category.CatalogId == q.CatalogId.Value);

            if (q.CategoryId.HasValue)
                query = query.Where(p => p.CategoryId == q.CategoryId.Value);

            // Accent-insensitive, multi-language: every term must appear somewhere in the folded search text
            var terms = SearchNormalizer.Terms(q.Search);
            foreach (var term in terms)
                query = query.Where(p => p.SearchText != null && p.SearchText.Contains(term));
            var phrase = string.Join(' ', terms);

            if (!string.IsNullOrWhiteSpace(q.Tag))
            {
                var tag = "," + q.Tag.Trim().ToLowerInvariant() + ",";
                query = query.Where(p => p.Tags != null && ("," + p.Tags + ",").Contains(tag));
            }

            if (q.OnSale == true)
                query = query.Where(p => p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price);

            if (q.InStock == true)
                query = query.Where(p => p.IsAvailable && p.Quantity > 0);

            // Effective price (sale price when on sale) inlined so EF can translate it
            if (q.MinPrice.HasValue)
                query = query.Where(p => (p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price ? p.SalePrice.Value : p.Price) >= q.MinPrice.Value);

            if (q.MaxPrice.HasValue)
                query = query.Where(p => (p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price ? p.SalePrice.Value : p.Price) <= q.MaxPrice.Value);

            var sort = q.Sort ?? (terms.Count > 0 ? "relevance" : "newest");
            if (sort == "relevance" && terms.Count == 0) sort = "best_selling";

            query = sort switch
            {
                // Name starts with the query (in any language) > a word in the name starts with it > name contains it > matched elsewhere
                "relevance" => query
                    .OrderByDescending(p => p.SearchName == null ? 0
                        : p.SearchName.Contains("|" + phrase) ? 3
                        : p.SearchName.Contains(" " + phrase) ? 2
                        : p.SearchName.Contains(phrase) ? 1 : 0)
                    .ThenByDescending(p => p.SoldCount)
                    .ThenBy(p => p.Id),
                "price_asc" => query.OrderBy(p => p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price ? p.SalePrice.Value : p.Price).ThenBy(p => p.Id),
                "price_desc" => query.OrderByDescending(p => p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price ? p.SalePrice.Value : p.Price).ThenBy(p => p.Id),
                "best_selling" => query.OrderByDescending(p => p.SoldCount).ThenByDescending(p => p.CreatedAt),
                "name" => query.OrderBy(p => p.Name),
                _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
            };

            var total = await query.CountAsync(ct);
            var rows = await ProjectRows(db, query, lang)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

            return new PagedResult<ProductCard>(rows.Select(ToCard).ToList(), page, pageSize, total);
        }

        public async Task<ProductDetail?> GetAsync(string idOrSlug, string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            var query = ActiveProducts(db);
            query = long.TryParse(idOrSlug, out var id)
                ? query.Where(p => p.Id == id)
                : query.Where(p => p.Slug == idOrSlug);

            var row = await ProjectRows(db, query, lang).FirstOrDefaultAsync(ct);
            if (row == null) return null;

            var extra = await query
                .Select(p => new
                {
                    Description = p.Translations.Where(t => t.LanguageCode == lang).Select(t => t.Description).FirstOrDefault() ?? p.Description,
                    p.Category.CatalogId,
                    CatalogName = db.CatalogTranslations
                        .Where(t => t.CatalogId == p.Category.CatalogId && t.LanguageCode == lang)
                        .Select(t => t.Name)
                        .FirstOrDefault() ?? p.Category.Catalog.Name,
                    p.MetaTitle,
                    p.MetaDescription,
                    Images = p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                        .Select(i => new { i.Id, i.ImageUrl, i.Alt, i.Title })
                        .ToList(),
                })
                .FirstAsync(ct);

            var images = extra.Images
                .Select(i => new ProductImage(i.Id, ImageUrls.ToPublic(i.ImageUrl)!, string.IsNullOrWhiteSpace(i.Alt) ? row.Name : i.Alt,
                    i.Title.StartsWith(Content.CreditsService.Prefix) ? i.Title[Content.CreditsService.Prefix.Length..] : null))
                .ToList();

            return new ProductDetail(ToCard(row), extra.Description, images, extra.CatalogId, extra.CatalogName,
                extra.MetaTitle, extra.MetaDescription);
        }

        public async Task<IReadOnlyList<ProductCard>> GetCardsAsync(IReadOnlyList<long> ids, string lang, CancellationToken ct = default)
        {
            if (ids.Count == 0) return [];
            lang = Languages.Normalize(lang);
            var distinct = ids.Distinct().ToList();
            var rows = await ProjectRows(db, ActiveProducts(db).Where(p => distinct.Contains(p.Id)), lang).ToListAsync(ct);
            var byId = rows.ToDictionary(r => r.Id);
            return distinct.Where(byId.ContainsKey).Select(i => ToCard(byId[i])).ToList();
        }

        public async Task RecordViewAsync(long productId, CancellationToken ct = default)
        {
            var updated = await db.ProductViews
                .Where(v => v.ProductId == productId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.View, v => v.View + 1), ct);

            if (updated == 0 && await db.Products.AnyAsync(p => p.Id == productId, ct))
            {
                db.ProductViews.Add(new ProductViewEntities { ProductId = productId, View = 1 });
                await db.SaveChangesAsync(ct);
            }
        }

        internal static IQueryable<ProductEntities> ActiveProducts(DataContext db)
            => db.Products.AsNoTracking().Where(p => !p.IsDelete && p.IsActive);

        internal static IQueryable<ProductRow> ProjectRows(DataContext db, IQueryable<ProductEntities> query, string lang)
            => query.Select(p => new ProductRow
            {
                Id = p.Id,
                Slug = p.Slug,
                Code = p.Code,
                Name = p.Translations.Where(t => t.LanguageCode == lang).Select(t => t.Name).FirstOrDefault() ?? p.Name,
                ShortDescription = p.Translations.Where(t => t.LanguageCode == lang).Select(t => t.ShortDescription).FirstOrDefault() ?? p.ShortDescription,
                Price = p.Price,
                SalePrice = p.SalePrice,
                IsOnSale = p.IsOnSale,
                Quantity = p.Quantity,
                IsAvailable = p.IsAvailable,
                ImageUrl = p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault(),
                CategoryId = p.CategoryId,
                CategoryName = db.CategoryTranslations
                    .Where(t => t.CategoryId == p.CategoryId && t.LanguageCode == lang)
                    .Select(t => t.Name)
                    .FirstOrDefault() ?? p.Category.Name,
                Rating = p.Rating,
                ReviewCount = p.ReviewCount,
                SoldCount = p.SoldCount,
                Tags = p.Tags,
                CreatedAt = p.CreatedAt,
            });

        internal static ProductCard ToCard(ProductRow r)
        {
            var effective = Pricing.EffectivePrice(r.Price, r.SalePrice, r.IsOnSale);
            var tags = string.IsNullOrWhiteSpace(r.Tags)
                ? Array.Empty<string>()
                : r.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return new ProductCard(
                r.Id,
                string.IsNullOrEmpty(r.Slug) ? r.Id.ToString() : r.Slug,
                r.Code,
                r.Name,
                r.ShortDescription,
                r.Price,
                effective,
                Pricing.DiscountPercent(r.Price, effective),
                r.IsAvailable && r.Quantity > 0,
                Math.Max(0, r.Quantity),
                ImageUrls.ToPublic(r.ImageUrl),
                r.CategoryId,
                r.CategoryName,
                r.Rating,
                r.ReviewCount,
                r.SoldCount,
                tags);
        }
    }
}
