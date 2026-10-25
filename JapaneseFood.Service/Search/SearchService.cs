using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Products;

namespace JapaneseFood.Service.Search
{
    public sealed record CategorySuggestion(long CatalogId, string CatalogSlug, long? CategoryId, string Name, string? JapaneseName,
        string? ImageUrl, int ProductCount);

    public sealed record SearchSuggestions(string Query, IReadOnlyList<ProductCard> Products, int TotalProducts,
        IReadOnlyList<CategorySuggestion> Categories);

    public interface ISearchService
    {
        /// <summary>Instant results for the search box: top products plus matching catalogs/categories.</summary>
        Task<SearchSuggestions> SuggestAsync(string query, string lang, int limit = 6, CancellationToken ct = default);
    }

    public class SearchService(IProductService products, ICatalogService catalog) : ISearchService
    {
        public async Task<SearchSuggestions> SuggestAsync(string query, string lang, int limit = 6, CancellationToken ct = default)
        {
            var terms = SearchNormalizer.Terms(query);
            if (terms.Count == 0) return new SearchSuggestions(query, [], 0, []);

            var page = await products.SearchAsync(new ProductQuery
            {
                Search = query,
                Sort = "relevance",
                PageSize = Math.Clamp(limit, 1, 12),
            }, lang, ct);

            // Catalog tree is cached, so matching categories in memory is free
            var tree = await catalog.GetTreeAsync(lang, ct);
            bool Matches(params string?[] names) => names
                .Select(SearchNormalizer.Normalize)
                .Any(n => n.Length > 0 && terms.All(t => n.Contains(t)));

            var categories = new List<CategorySuggestion>();
            foreach (var c in tree)
            {
                if (Matches(c.Name, c.JapaneseName))
                    categories.Add(new CategorySuggestion(c.Id, c.Slug, null, c.Name, c.JapaneseName, c.ImageUrl, c.ProductCount));
                categories.AddRange(c.Categories
                    .Where(x => Matches(x.Name, x.JapaneseName))
                    .Select(x => new CategorySuggestion(c.Id, c.Slug, x.Id, x.Name, x.JapaneseName, x.ImageUrl, x.ProductCount)));
            }

            return new SearchSuggestions(query, page.Items, page.TotalItems, categories.Take(4).ToList());
        }
    }
}
