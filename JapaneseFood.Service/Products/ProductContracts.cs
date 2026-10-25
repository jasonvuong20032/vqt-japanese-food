namespace JapaneseFood.Service.Products
{
    public sealed record ProductCard(
        long Id,
        string Slug,
        string Code,
        string Name,
        string? ShortDescription,
        decimal Price,
        decimal EffectivePrice,
        int DiscountPercent,
        bool InStock,
        int Stock,
        string? ImageUrl,
        long CategoryId,
        string CategoryName,
        int Rating,
        int ReviewCount,
        int SoldCount,
        IReadOnlyList<string> Tags);

    /// <param name="Credit">Photographer and licence for openly licensed photos, shown under the image.</param>
    public sealed record ProductImage(int Id, string Url, string? Alt, string? Credit);

    public sealed record ProductDetail(
        ProductCard Card,
        string? Description,
        IReadOnlyList<ProductImage> Images,
        long CatalogId,
        string CatalogName,
        string? MetaTitle,
        string? MetaDescription);

    public sealed class ProductQuery
    {
        public string? Search { get; set; }
        public long? CatalogId { get; set; }
        public long? CategoryId { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public string? Tag { get; set; }
        public bool? OnSale { get; set; }
        public bool? InStock { get; set; }
        /// <summary>relevance (default when searching) | newest (default otherwise) | best_selling | price_asc | price_desc | name</summary>
        public string? Sort { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 24;
    }

    /// <summary>Flat row materialised from SQL before in-memory shaping into <see cref="ProductCard"/>.</summary>
    internal sealed class ProductRow
    {
        public long Id { get; set; }
        public string? Slug { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? ShortDescription { get; set; }
        public decimal Price { get; set; }
        public decimal? SalePrice { get; set; }
        public bool IsOnSale { get; set; }
        public int Quantity { get; set; }
        public bool IsAvailable { get; set; }
        public string? ImageUrl { get; set; }
        public long CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int Rating { get; set; }
        public int ReviewCount { get; set; }
        public int SoldCount { get; set; }
        public string? Tags { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
