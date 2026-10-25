using JapaneseFood.Entity;
using JapaneseFood.Entity.Article;
using JapaneseFood.Entity.Category;
using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed class LocalizedText
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public sealed class NameInput
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; }
        /// <summary>Catalog only: URL slug (generated from the name when empty) and optional banner.</summary>
        public string? Slug { get; set; }
        public string? CoverImageUrl { get; set; }
        /// <summary>Category only.</summary>
        public long CatalogId { get; set; }
        /// <summary>languageCode → translation (empty name removes it).</summary>
        public Dictionary<string, LocalizedText> Translations { get; set; } = [];
    }

    public sealed record AdminCategory(long Id, long CatalogId, string Name, string? Description, bool IsActive, int SortOrder,
        int ProductCount, IReadOnlyDictionary<string, LocalizedText> Translations);

    public sealed record AdminCatalog(long Id, string? Slug, string Name, string? Description, string? CoverImageUrl, bool IsActive,
        int SortOrder, IReadOnlyDictionary<string, LocalizedText> Translations, IReadOnlyList<AdminCategory> Categories);

    public interface IAdminCatalogService
    {
        Task<IReadOnlyList<AdminCatalog>> GetTreeAsync(CancellationToken ct = default);
        Task<long> SaveCatalogAsync(long? id, NameInput input, string by, CancellationToken ct = default);
        Task DeleteCatalogAsync(long id, string by, CancellationToken ct = default);
        Task<long> SaveCategoryAsync(long? id, NameInput input, string by, CancellationToken ct = default);
        Task DeleteCategoryAsync(long id, string by, CancellationToken ct = default);
    }

    public class AdminCatalogService(DataContext db, ICatalogService catalog, ISearchIndexer search, TimeProvider clock) : IAdminCatalogService
    {
        public async Task<IReadOnlyList<AdminCatalog>> GetTreeAsync(CancellationToken ct = default)
        {
            var catalogs = await db.Catalogs.AsNoTracking().Where(c => !c.IsDelete).OrderBy(c => c.SortOrder).ThenBy(c => c.CreatedAt).ToListAsync(ct);
            var categories = await db.Categorys.AsNoTracking().Where(c => !c.IsDelete).OrderBy(c => c.SortOrder).ThenBy(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id, c.CatalogId, c.Name, c.Description, c.IsActive, c.SortOrder,
                    ProductCount = db.Products.Count(p => p.CategoryId == c.Id && !p.IsDelete),
                })
                .ToListAsync(ct);
            var catalogTr = await db.CatalogTranslations.AsNoTracking().ToListAsync(ct);
            var categoryTr = await db.CategoryTranslations.AsNoTracking().ToListAsync(ct);

            return catalogs.Select(c => new AdminCatalog(
                c.Id, c.Slug, c.Name, c.Description, ImageUrls.ToPublic(c.CoverImageUrl), c.IsActive, c.SortOrder,
                catalogTr.Where(t => t.CatalogId == c.Id)
                    .ToDictionary(t => t.LanguageCode, t => new LocalizedText { Name = t.Name, Description = t.Description }),
                categories.Where(x => x.CatalogId == c.Id).Select(x => new AdminCategory(
                    x.Id, x.CatalogId, x.Name, x.Description, x.IsActive, x.SortOrder, x.ProductCount,
                    categoryTr.Where(t => t.CategoryId == x.Id)
                        .ToDictionary(t => t.LanguageCode, t => new LocalizedText { Name = t.Name, Description = t.Description })))
                    .ToList()))
                .ToList();
        }

        public async Task<long> SaveCatalogAsync(long? id, NameInput input, string by, CancellationToken ct = default)
        {
            Validate(input);
            var now = clock.GetLocalNow().DateTime;
            CatalogEntities entity;
            if (id.HasValue)
            {
                entity = await db.Catalogs.FirstOrDefaultAsync(c => c.Id == id && !c.IsDelete, ct)
                    ?? throw AppException.NotFound("catalog_not_found", "Catalog not found.");
            }
            else
            {
                entity = new CatalogEntities { Name = "", CreatedAt = now, CreatedBy = by };
                db.Catalogs.Add(entity);
            }
            entity.Name = input.Name.Trim();
            entity.Description = input.Description?.Trim();
            entity.IsActive = input.IsActive;
            entity.SortOrder = input.SortOrder;
            entity.CoverImageUrl = string.IsNullOrWhiteSpace(input.CoverImageUrl) ? null : input.CoverImageUrl.Trim();
            entity.UpdatedAt = now;
            entity.UpdatedBy = by;
            if (!string.IsNullOrWhiteSpace(input.Slug) || string.IsNullOrEmpty(entity.Slug))
                entity.Slug = await UniqueCatalogSlugAsync(input.Slug, input.Name, id, ct);
            await db.SaveChangesAsync(ct);

            var existing = await db.CatalogTranslations.Where(t => t.CatalogId == entity.Id).ToListAsync(ct);
            foreach (var (lang, text) in SupportedTranslations(input))
            {
                var row = existing.FirstOrDefault(t => t.LanguageCode == lang);
                if (string.IsNullOrWhiteSpace(text.Name)) { if (row != null) db.CatalogTranslations.Remove(row); continue; }
                if (row == null)
                {
                    row = new CatalogTranslationEntities { CatalogId = entity.Id, LanguageCode = lang, Name = "" };
                    db.CatalogTranslations.Add(row);
                }
                row.Name = text.Name.Trim();
                row.Description = text.Description?.Trim();
            }
            await db.SaveChangesAsync(ct);
            catalog.InvalidateCache();
            return entity.Id;
        }

        public async Task DeleteCatalogAsync(long id, string by, CancellationToken ct = default)
        {
            if (await db.Categorys.AnyAsync(c => c.CatalogId == id && !c.IsDelete, ct))
                throw AppException.Conflict("catalog_not_empty", "Move or delete its categories first.");
            await db.Catalogs.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDelete, true).SetProperty(c => c.UpdatedBy, by), ct);
            catalog.InvalidateCache();
        }

        public async Task<long> SaveCategoryAsync(long? id, NameInput input, string by, CancellationToken ct = default)
        {
            Validate(input);
            if (!await db.Catalogs.AnyAsync(c => c.Id == input.CatalogId && !c.IsDelete, ct))
                throw AppException.BadRequest("validation_failed", "Choose a catalog.", new Dictionary<string, object?> { ["catalogId"] = "required" });

            var now = clock.GetLocalNow().DateTime;
            CategoryEntities entity;
            if (id.HasValue)
            {
                entity = await db.Categorys.FirstOrDefaultAsync(c => c.Id == id && !c.IsDelete, ct)
                    ?? throw AppException.NotFound("category_not_found", "Category not found.");
            }
            else
            {
                entity = new CategoryEntities { Name = "", CreatedAt = now, CreatedBy = by };
                db.Categorys.Add(entity);
            }
            entity.Name = input.Name.Trim();
            entity.Description = input.Description?.Trim();
            entity.CatalogId = input.CatalogId;
            entity.IsActive = input.IsActive;
            entity.SortOrder = input.SortOrder;
            entity.UpdatedAt = now;
            entity.UpdatedBy = by;
            await db.SaveChangesAsync(ct);

            var existing = await db.CategoryTranslations.Where(t => t.CategoryId == entity.Id).ToListAsync(ct);
            foreach (var (lang, text) in SupportedTranslations(input))
            {
                var row = existing.FirstOrDefault(t => t.LanguageCode == lang);
                if (string.IsNullOrWhiteSpace(text.Name)) { if (row != null) db.CategoryTranslations.Remove(row); continue; }
                if (row == null)
                {
                    row = new CategoryTranslationEntities { CategoryId = entity.Id, LanguageCode = lang, Name = "" };
                    db.CategoryTranslations.Add(row);
                }
                row.Name = text.Name.Trim();
                row.Description = text.Description?.Trim();
            }
            await db.SaveChangesAsync(ct);

            // Category names are searchable ("ramen" finds every ramen), so refresh its products' search text
            await search.RebuildCategoryAsync(entity.Id, ct);
            catalog.InvalidateCache();
            return entity.Id;
        }

        public async Task DeleteCategoryAsync(long id, string by, CancellationToken ct = default)
        {
            if (await db.Products.AnyAsync(p => p.CategoryId == id && !p.IsDelete, ct))
                throw AppException.Conflict("category_not_empty", "Move or delete its products first.");
            await db.Categorys.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDelete, true).SetProperty(c => c.UpdatedBy, by), ct);
            catalog.InvalidateCache();
        }

        private static IEnumerable<KeyValuePair<string, LocalizedText>> SupportedTranslations(NameInput input)
            => input.Translations.Where(t => t.Key != Languages.Default && Languages.Supported.Contains(t.Key));

        private async Task<string> UniqueCatalogSlugAsync(string? requested, string name, long? excludeId, CancellationToken ct)
        {
            var baseSlug = SlugHelper.Slugify(string.IsNullOrWhiteSpace(requested) ? name : requested);
            if (string.IsNullOrEmpty(baseSlug)) baseSlug = "menu";
            var slug = baseSlug;
            for (var i = 2; await db.Catalogs.AnyAsync(c => c.Slug == slug && c.Id != excludeId, ct); i++)
                slug = $"{baseSlug}-{i}";
            return slug;
        }

        private static void Validate(NameInput input)
        {
            if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 200)
                throw AppException.BadRequest("validation_failed", "Name is required.", new Dictionary<string, object?> { ["name"] = "required" });
        }
    }
}
