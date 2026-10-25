using JapaneseFood.Entity;
using JapaneseFood.Entity.Article;
using JapaneseFood.Entity.Category;
using JapaneseFood.Entity.Image;
using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Content;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace JapaneseFood.Service.Setup
{
    /// <summary>
    /// Loads the curated menu (seed/menu.json), its photos (seed/images) and the "Our story" page (seed/about.json).
    /// Idempotent: catalogs/categories/products are matched by id, slug or code; photos by their attribution,
    /// so running it twice changes nothing. Prices and stock of existing products are never touched.
    /// </summary>
    public class MenuSeeder(
        DataContext db,
        IImageStorage storage,
        ISearchIndexer search,
        ICatalogService catalog,
        IStoreContentService content,
        TimeProvider clock,
        ILogger<MenuSeeder> logger)
    {
        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
        private static readonly string[] OtherLanguages = ["en", "ja", "ko", "fr"];

        public sealed record Report(int CatalogsSaved, int CategoriesSaved, int ProductsCreated, int ProductsUpdated, int ImagesAdded, int ContentPages);

        public async Task<Report> SeedAsync(string seedDir, CancellationToken ct = default)
        {
            var menu = JsonSerializer.Deserialize<MenuFile>(await File.ReadAllTextAsync(Path.Combine(seedDir, "menu.json"), ct), Json)
                ?? throw new InvalidOperationException("menu.json is empty");
            var credits = JsonSerializer.Deserialize<Dictionary<string, CreditEntry>>(
                await File.ReadAllTextAsync(Path.Combine(seedDir, "images", "credits.json"), ct), Json) ?? [];
            var now = clock.GetLocalNow().DateTime;

            // ---------------------------------------------------------------- catalogs & categories
            var categoryIds = new Dictionary<string, long>();
            int catalogsSaved = 0, categoriesSaved = 0;
            foreach (var c in menu.Catalogs)
            {
                var entity = c.Id.HasValue
                    ? await db.Catalogs.FirstAsync(x => x.Id == c.Id, ct)
                    : await db.Catalogs.FirstOrDefaultAsync(x => x.Slug == c.Slug, ct);
                if (entity == null)
                {
                    entity = new CatalogEntities { Name = "", CreatedAt = now, CreatedBy = "seed" };
                    db.Catalogs.Add(entity);
                }
                entity.Name = c.Name["vi"];
                entity.Description = c.Description.GetValueOrDefault("vi");
                entity.Slug = c.Slug;
                entity.SortOrder = c.SortOrder;
                // Curated banner photo; the file itself is written below when that product's image is seeded
                if (c.Cover != null) entity.CoverImageUrl = "/Uploads/Product/seed-" + c.Cover;
                entity.IsActive = true;
                entity.IsDelete = false;
                entity.UpdatedAt = now;
                entity.UpdatedBy = "seed";
                await db.SaveChangesAsync(ct);
                await UpsertCatalogTranslationsAsync(entity.Id, c.Name, c.Description, ct);
                catalogsSaved++;

                foreach (var g in c.Categories)
                {
                    var category = g.Id.HasValue
                        ? await db.Categorys.FirstAsync(x => x.Id == g.Id, ct)
                        : await db.Categorys.FirstOrDefaultAsync(x => x.CatalogId == entity.Id && x.Name == g.Name["vi"] && !x.IsDelete, ct);
                    if (category == null)
                    {
                        category = new CategoryEntities { Name = "", CreatedAt = now, CreatedBy = "seed" };
                        db.Categorys.Add(category);
                    }
                    category.Name = g.Name["vi"];
                    category.Description = g.Description.GetValueOrDefault("vi");
                    category.CatalogId = entity.Id;
                    category.SortOrder = g.SortOrder;
                    category.IsActive = true;
                    category.IsDelete = false;
                    category.UpdatedAt = now;
                    category.UpdatedBy = "seed";
                    await db.SaveChangesAsync(ct);
                    await UpsertCategoryTranslationsAsync(category.Id, g.Name, g.Description, ct);
                    categoryIds[g.Key] = category.Id;
                    categoriesSaved++;
                }
            }

            // ---------------------------------------------------------------- products
            int created = 0, updated = 0, images = 0;
            var touched = new List<long>();
            var takenSlugs = new HashSet<string>(await db.Products.Where(p => p.Slug != null).Select(p => p.Slug!).ToListAsync(ct));

            foreach (var p in menu.Products)
            {
                ProductEntities? product = p.Id.HasValue
                    ? await db.Products.Include(x => x.Translations).Include(x => x.Images).FirstAsync(x => x.Id == p.Id, ct)
                    : await db.Products.Include(x => x.Translations).Include(x => x.Images).FirstOrDefaultAsync(x => x.Code == p.Code, ct);

                if (product == null)
                {
                    product = new ProductEntities
                    {
                        Code = p.Code!,
                        Name = p.Name["vi"],
                        Price = p.Price ?? 0,
                        SalePrice = p.SalePrice,
                        IsOnSale = p.SalePrice.HasValue,
                        Quantity = p.Stock ?? 50,
                        IsAvailable = true,
                        IsActive = true,
                        CreatedAt = now,
                        CreatedBy = "seed",
                    };
                    var baseSlug = SlugHelper.Slugify(p.Name["vi"]);
                    var slug = baseSlug;
                    for (var i = 2; takenSlugs.Contains(slug); i++) slug = $"{baseSlug}-{i}";
                    takenSlugs.Add(slug);
                    product.Slug = slug;
                    db.Products.Add(product);
                    created++;
                }
                else
                {
                    updated++;
                }

                product.Name = p.Name["vi"];
                product.ShortDescription = p.Short.GetValueOrDefault("vi");
                product.CategoryId = categoryIds[p.Category];
                product.Tags = p.Tags.Count == 0 ? null : string.Join(',', p.Tags);
                product.IsDelete = false;
                product.UpdatedAt = now;
                product.UpdatedBy = "seed";

                foreach (var lang in OtherLanguages)
                {
                    var tr = product.Translations.FirstOrDefault(t => t.LanguageCode == lang);
                    if (tr == null)
                    {
                        tr = new ProductTranslationEntities { LanguageCode = lang, Name = "" };
                        product.Translations.Add(tr);
                    }
                    tr.Name = p.Name[lang];
                    tr.ShortDescription = p.Short.GetValueOrDefault(lang);
                }
                await db.SaveChangesAsync(ct);

                if (p.Image != null && credits.TryGetValue(p.Image, out var credit))
                {
                    var title = "Photo: " + credit.Credit;
                    if (!product.Images.Any(i => i.Title == title))
                    {
                        await using var stream = File.OpenRead(Path.Combine(seedDir, "images", p.Image));
                        var url = await storage.SaveNamedAsync(stream, "seed-" + p.Image, "Product", ct);
                        // The new, higher-resolution photo becomes the cover; earlier photos stay in the gallery
                        foreach (var existing in product.Images) existing.SortOrder += 1;
                        product.Images.Add(new ImageEntities { ImageUrl = url, Alt = p.Name["vi"], Title = title, SortOrder = 0 });
                        await db.SaveChangesAsync(ct);
                        images++;
                    }
                }
                touched.Add(product.Id);
            }

            // ---------------------------------------------------------------- "Our story" page
            var pages = 0;
            var aboutPath = Path.Combine(seedDir, "about.json");
            if (File.Exists(aboutPath))
            {
                var about = JsonNode.Parse(await File.ReadAllTextAsync(aboutPath, ct))!.AsObject();
                var urls = new Dictionary<string, string>();
                foreach (var (lang, node) in about)
                {
                    foreach (var section in node!.AsObject().Select(kv => kv.Value).OfType<JsonObject>())
                    {
                        if (section["image"]?.GetValue<string>() is not { } file || !credits.TryGetValue(file, out var credit)) continue;
                        if (!urls.TryGetValue(file, out var url))
                        {
                            await using var stream = File.OpenRead(Path.Combine(seedDir, "images", file));
                            url = await storage.SaveNamedAsync(stream, file, "Content", ct);
                            urls[file] = url;
                        }
                        section["image"] = url;
                        section["imageCredit"] = credit.Credit;
                    }
                    await content.SetAsync("about", lang, node.ToJsonString(), ct);
                    pages++;
                }
            }

            await search.RebuildAsync(touched, ct);
            catalog.InvalidateCache();

            var report = new Report(catalogsSaved, categoriesSaved, created, updated, images, pages);
            logger.LogInformation("Menu seed done: {Report}", report);
            return report;
        }

        private async Task UpsertCatalogTranslationsAsync(long catalogId, Dictionary<string, string> names, Dictionary<string, string> descriptions, CancellationToken ct)
        {
            var rows = await db.CatalogTranslations.Where(t => t.CatalogId == catalogId).ToListAsync(ct);
            foreach (var lang in OtherLanguages)
            {
                var row = rows.FirstOrDefault(r => r.LanguageCode == lang);
                if (row == null)
                {
                    row = new CatalogTranslationEntities { CatalogId = catalogId, LanguageCode = lang, Name = "" };
                    db.CatalogTranslations.Add(row);
                }
                row.Name = names[lang];
                row.Description = descriptions.GetValueOrDefault(lang);
            }
            await db.SaveChangesAsync(ct);
        }

        private async Task UpsertCategoryTranslationsAsync(long categoryId, Dictionary<string, string> names, Dictionary<string, string> descriptions, CancellationToken ct)
        {
            var rows = await db.CategoryTranslations.Where(t => t.CategoryId == categoryId).ToListAsync(ct);
            foreach (var lang in OtherLanguages)
            {
                var row = rows.FirstOrDefault(r => r.LanguageCode == lang);
                if (row == null)
                {
                    row = new CategoryTranslationEntities { CategoryId = categoryId, LanguageCode = lang, Name = "" };
                    db.CategoryTranslations.Add(row);
                }
                row.Name = names[lang];
                row.Description = descriptions.GetValueOrDefault(lang);
            }
            await db.SaveChangesAsync(ct);
        }

        private sealed class MenuFile
        {
            public List<CatalogSeed> Catalogs { get; set; } = [];
            public List<ProductSeed> Products { get; set; } = [];
        }

        private sealed class CatalogSeed
        {
            public long? Id { get; set; }
            public string Slug { get; set; } = "";
            public string? Cover { get; set; }
            public int SortOrder { get; set; }
            public Dictionary<string, string> Name { get; set; } = [];
            public Dictionary<string, string> Description { get; set; } = [];
            public List<CategorySeed> Categories { get; set; } = [];
        }

        private sealed class CategorySeed
        {
            public string Key { get; set; } = "";
            public long? Id { get; set; }
            public int SortOrder { get; set; }
            public Dictionary<string, string> Name { get; set; } = [];
            public Dictionary<string, string> Description { get; set; } = [];
        }

        private sealed class ProductSeed
        {
            public long? Id { get; set; }
            public string? Code { get; set; }
            public string Category { get; set; } = "";
            public decimal? Price { get; set; }
            public decimal? SalePrice { get; set; }
            public int? Stock { get; set; }
            public List<string> Tags { get; set; } = [];
            public string? Image { get; set; }
            public Dictionary<string, string> Name { get; set; } = [];
            public Dictionary<string, string> Short { get; set; } = [];
        }

        private sealed class CreditEntry
        {
            public string Credit { get; set; } = "";
        }
    }
}
