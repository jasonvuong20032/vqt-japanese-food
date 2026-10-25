using JapaneseFood.Common;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Image;
using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed class AdminProductQuery
    {
        public string? Search { get; set; }
        public long? CategoryId { get; set; }
        /// <summary>all (default) | active | inactive | out_of_stock | low_stock | on_sale</summary>
        public string? Status { get; set; }
        /// <summary>newest (default) | name | price_asc | price_desc | stock_asc | best_selling</summary>
        public string? Sort { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public sealed record AdminProductRow(long Id, string Code, string Name, string Slug, string? ImageUrl, long CategoryId,
        string CategoryName, decimal Price, decimal? SalePrice, bool IsOnSale, int Quantity, int SoldCount, bool IsActive,
        bool IsAvailable, DateTime UpdatedAt);

    public sealed class TranslationInput
    {
        public string LanguageCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? ShortDescription { get; set; }
        public string? Description { get; set; }
    }

    public sealed class AdminProductInput
    {
        public string? Code { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Slug { get; set; }
        public long CategoryId { get; set; }
        public string? ShortDescription { get; set; }
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public decimal? SalePrice { get; set; }
        public bool IsOnSale { get; set; }
        public int Quantity { get; set; }
        public bool IsAvailable { get; set; } = true;
        public bool IsActive { get; set; } = true;
        public List<string> Tags { get; set; } = [];
        public string? MetaTitle { get; set; }
        public string? MetaDescription { get; set; }
        public List<TranslationInput> Translations { get; set; } = [];
    }

    public sealed record AdminImage(int Id, string Url, string? Alt, int SortOrder);

    public sealed record AdminProductEdit(long Id, AdminProductInput Data, IReadOnlyList<AdminImage> Images, int SoldCount,
        DateTime CreatedAt, DateTime UpdatedAt);

    public interface IAdminProductService
    {
        Task<PagedResult<AdminProductRow>> ListAsync(AdminProductQuery query, CancellationToken ct = default);
        Task<AdminProductEdit?> GetAsync(long id, CancellationToken ct = default);
        Task<AdminProductEdit> CreateAsync(AdminProductInput input, string by, CancellationToken ct = default);
        Task<AdminProductEdit> UpdateAsync(long id, AdminProductInput input, string by, CancellationToken ct = default);
        Task<int> SetActiveAsync(IReadOnlyList<long> ids, bool active, string by, CancellationToken ct = default);
        Task<int> DeleteAsync(IReadOnlyList<long> ids, string by, CancellationToken ct = default);

        Task<AdminImage> AddImageAsync(long productId, Stream content, string extension, string? alt, CancellationToken ct = default);
        Task DeleteImageAsync(long productId, int imageId, CancellationToken ct = default);
        Task ReorderImagesAsync(long productId, IReadOnlyList<int> orderedImageIds, CancellationToken ct = default);
    }

    public class AdminProductService(DataContext db, IImageStorage storage, ICatalogService catalog, ISearchIndexer search, TimeProvider clock)
        : IAdminProductService
    {
        public async Task<PagedResult<AdminProductRow>> ListAsync(AdminProductQuery q, CancellationToken ct = default)
        {
            var (page, size) = Paging.Normalize(q.Page, q.PageSize, 20, 100);
            var query = db.Products.AsNoTracking().Where(p => !p.IsDelete);

            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var term = q.Search.Trim();
                query = query.Where(p => p.Name.Contains(term) || p.Code.Contains(term));
            }
            if (q.CategoryId.HasValue) query = query.Where(p => p.CategoryId == q.CategoryId);

            query = q.Status switch
            {
                "active" => query.Where(p => p.IsActive),
                "inactive" => query.Where(p => !p.IsActive),
                "out_of_stock" => query.Where(p => p.Quantity <= 0 || !p.IsAvailable),
                "low_stock" => query.Where(p => p.Quantity > 0 && p.Quantity <= 10),
                "on_sale" => query.Where(p => p.IsOnSale && p.SalePrice != null && p.SalePrice < p.Price),
                _ => query,
            };

            query = q.Sort switch
            {
                "name" => query.OrderBy(p => p.Name),
                "price_asc" => query.OrderBy(p => p.Price),
                "price_desc" => query.OrderByDescending(p => p.Price),
                "stock_asc" => query.OrderBy(p => p.Quantity),
                "best_selling" => query.OrderByDescending(p => p.SoldCount),
                _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
            };

            var total = await query.CountAsync(ct);
            var rows = await query.Skip((page - 1) * size).Take(size)
                .Select(p => new
                {
                    p.Id, p.Code, p.Name, p.Slug, p.CategoryId, CategoryName = p.Category.Name,
                    p.Price, p.SalePrice, p.IsOnSale, p.Quantity, p.SoldCount, p.IsActive, p.IsAvailable, p.UpdatedAt, p.CreatedAt,
                    Image = p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault(),
                })
                .ToListAsync(ct);

            return new PagedResult<AdminProductRow>(rows.Select(r => new AdminProductRow(
                r.Id, r.Code, r.Name, r.Slug ?? r.Id.ToString(), ImageUrls.ToPublic(r.Image), r.CategoryId, r.CategoryName,
                r.Price, r.SalePrice, r.IsOnSale, r.Quantity, r.SoldCount, r.IsActive, r.IsAvailable,
                r.UpdatedAt == default ? r.CreatedAt : r.UpdatedAt)).ToList(), page, size, total);
        }

        public async Task<AdminProductEdit?> GetAsync(long id, CancellationToken ct = default)
        {
            var p = await db.Products.AsNoTracking()
                .Include(x => x.Translations)
                .Include(x => x.Images)
                .FirstOrDefaultAsync(x => x.Id == id && !x.IsDelete, ct);
            return p == null ? null : ToEdit(p);
        }

        public async Task<AdminProductEdit> CreateAsync(AdminProductInput input, string by, CancellationToken ct = default)
        {
            await ValidateAsync(input, null, ct);
            var now = clock.GetLocalNow().DateTime;
            var product = new ProductEntities
            {
                Code = string.IsNullOrWhiteSpace(input.Code) ? CodeGeneratorExtension.GenerateProductCode().ToUpperInvariant() : input.Code.Trim(),
                Name = input.Name.Trim(),
                CreatedAt = now,
                CreatedBy = by,
            };
            Apply(product, input, now, by);
            product.Slug = await UniqueSlugAsync(input.Slug, input.Name, null, ct);
            db.Products.Add(product);
            await db.SaveChangesAsync(ct);
            await search.RebuildAsync([product.Id], ct);
            catalog.InvalidateCache();
            return (await GetAsync(product.Id, ct))!;
        }

        public async Task<AdminProductEdit> UpdateAsync(long id, AdminProductInput input, string by, CancellationToken ct = default)
        {
            var product = await db.Products.Include(p => p.Translations).FirstOrDefaultAsync(p => p.Id == id && !p.IsDelete, ct)
                ?? throw AppException.NotFound("product_not_found", "Product not found.");

            await ValidateAsync(input, id, ct);
            var now = clock.GetLocalNow().DateTime;
            if (!string.IsNullOrWhiteSpace(input.Code)) product.Code = input.Code.Trim();
            product.Name = input.Name.Trim();
            Apply(product, input, now, by);
            if (!string.IsNullOrWhiteSpace(input.Slug) || string.IsNullOrEmpty(product.Slug))
                product.Slug = await UniqueSlugAsync(input.Slug, input.Name, id, ct);

            await db.SaveChangesAsync(ct);
            await search.RebuildAsync([id], ct);
            catalog.InvalidateCache();
            return (await GetAsync(id, ct))!;
        }

        public async Task<int> SetActiveAsync(IReadOnlyList<long> ids, bool active, string by, CancellationToken ct = default)
        {
            var now = clock.GetLocalNow().DateTime;
            var n = await db.Products.Where(p => ids.Contains(p.Id) && !p.IsDelete)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, active).SetProperty(p => p.UpdatedAt, now).SetProperty(p => p.UpdatedBy, by), ct);
            catalog.InvalidateCache();
            return n;
        }

        public async Task<int> DeleteAsync(IReadOnlyList<long> ids, string by, CancellationToken ct = default)
        {
            var now = clock.GetLocalNow().DateTime;
            // Soft delete keeps order history and reports intact
            var n = await db.Products.Where(p => ids.Contains(p.Id) && !p.IsDelete)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDelete, true).SetProperty(p => p.UpdatedAt, now).SetProperty(p => p.UpdatedBy, by), ct);
            catalog.InvalidateCache();
            return n;
        }

        public async Task<AdminImage> AddImageAsync(long productId, Stream content, string extension, string? alt, CancellationToken ct = default)
        {
            if (!await db.Products.AnyAsync(p => p.Id == productId && !p.IsDelete, ct))
                throw AppException.NotFound("product_not_found", "Product not found.");

            var url = await storage.SaveAsync(content, extension, "Product", ct);
            var nextSort = (await db.Images.Where(i => i.ProductId == productId).MaxAsync(i => (int?)i.SortOrder, ct) ?? 0) + 1;
            var image = new ImageEntities { ProductId = productId, ImageUrl = url, Alt = alt?.Trim() ?? "", Title = "", SortOrder = nextSort };
            db.Images.Add(image);
            await db.SaveChangesAsync(ct);
            return new AdminImage(image.Id, ImageUrls.ToPublic(url)!, image.Alt, image.SortOrder);
        }

        public async Task DeleteImageAsync(long productId, int imageId, CancellationToken ct = default)
        {
            var image = await db.Images.FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == productId, ct)
                ?? throw AppException.NotFound("image_not_found", "Image not found.");
            db.Images.Remove(image);
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(image.ImageUrl, ct);
        }

        public async Task ReorderImagesAsync(long productId, IReadOnlyList<int> orderedImageIds, CancellationToken ct = default)
        {
            var images = await db.Images.Where(i => i.ProductId == productId).ToListAsync(ct);
            for (var i = 0; i < orderedImageIds.Count; i++)
            {
                var img = images.FirstOrDefault(x => x.Id == orderedImageIds[i]);
                if (img != null) img.SortOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
        }

        private async Task ValidateAsync(AdminProductInput input, long? id, CancellationToken ct)
        {
            var errors = new Dictionary<string, object?>();
            if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 300) errors["name"] = "required";
            if (input.Price <= 0) errors["price"] = "must_be_positive";
            if (input.IsOnSale && (!input.SalePrice.HasValue || input.SalePrice <= 0 || input.SalePrice >= input.Price))
                errors["salePrice"] = "must_be_below_price";
            if (input.Quantity < 0) errors["quantity"] = "must_not_be_negative";
            if (!await db.Categorys.AnyAsync(c => c.Id == input.CategoryId && !c.IsDelete, ct)) errors["categoryId"] = "required";
            if (!string.IsNullOrWhiteSpace(input.Code)
                && await db.Products.AnyAsync(p => p.Code == input.Code.Trim() && p.Id != id, ct))
                errors["code"] = "duplicate";
            foreach (var t in input.Translations.Where(t => !Languages.Supported.Contains(t.LanguageCode)))
                errors[$"translations.{t.LanguageCode}"] = "unsupported_language";

            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);
        }

        private void Apply(ProductEntities p, AdminProductInput input, DateTime now, string by)
        {
            p.CategoryId = input.CategoryId;
            p.ShortDescription = input.ShortDescription?.Trim();
            p.Description = input.Description;
            p.Price = input.Price;
            p.SalePrice = input.SalePrice;
            p.IsOnSale = input.IsOnSale;
            p.Quantity = input.Quantity;
            p.IsAvailable = input.IsAvailable;
            p.IsActive = input.IsActive;
            p.Tags = input.Tags.Count == 0 ? null : string.Join(',', input.Tags
                .Select(t => t.Trim().ToLowerInvariant()).Where(t => t.Length > 0 && !t.Contains(',')).Distinct());
            p.MetaTitle = input.MetaTitle?.Trim();
            p.MetaDescription = input.MetaDescription?.Trim();
            p.UpdatedAt = now;
            p.UpdatedBy = by;

            // Base columns hold Vietnamese; translations hold the other languages
            foreach (var t in input.Translations.Where(t => t.LanguageCode != Languages.Default))
            {
                var existing = p.Translations.FirstOrDefault(x => x.LanguageCode == t.LanguageCode);
                if (string.IsNullOrWhiteSpace(t.Name))
                {
                    if (existing != null) db.ProductTranslations.Remove(existing);
                    continue;
                }
                if (existing == null)
                {
                    existing = new ProductTranslationEntities { LanguageCode = t.LanguageCode, Name = t.Name.Trim() };
                    p.Translations.Add(existing);
                }
                existing.Name = t.Name.Trim();
                existing.ShortDescription = t.ShortDescription?.Trim();
                existing.Description = t.Description;
            }
        }

        private async Task<string> UniqueSlugAsync(string? requested, string name, long? excludeId, CancellationToken ct)
        {
            var baseSlug = SlugHelper.Slugify(string.IsNullOrWhiteSpace(requested) ? name : requested);
            if (string.IsNullOrEmpty(baseSlug)) baseSlug = "product";

            var slug = baseSlug;
            for (var i = 2; await db.Products.AnyAsync(p => p.Slug == slug && p.Id != excludeId, ct); i++)
                slug = $"{baseSlug}-{i}";
            return slug;
        }

        private static AdminProductEdit ToEdit(ProductEntities p) => new(
            p.Id,
            new AdminProductInput
            {
                Code = p.Code,
                Name = p.Name,
                Slug = p.Slug,
                CategoryId = p.CategoryId,
                ShortDescription = p.ShortDescription,
                Description = p.Description,
                Price = p.Price,
                SalePrice = p.SalePrice,
                IsOnSale = p.IsOnSale,
                Quantity = p.Quantity,
                IsAvailable = p.IsAvailable,
                IsActive = p.IsActive,
                Tags = string.IsNullOrWhiteSpace(p.Tags) ? [] : p.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                MetaTitle = p.MetaTitle,
                MetaDescription = p.MetaDescription,
                Translations = p.Translations.Select(t => new TranslationInput
                {
                    LanguageCode = t.LanguageCode,
                    Name = t.Name,
                    ShortDescription = t.ShortDescription,
                    Description = t.Description,
                }).ToList(),
            },
            p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                .Select(i => new AdminImage(i.Id, ImageUrls.ToPublic(i.ImageUrl)!, i.Alt, i.SortOrder)).ToList(),
            p.SoldCount,
            p.CreatedAt,
            p.UpdatedAt);
    }
}
