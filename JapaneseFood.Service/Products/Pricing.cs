namespace JapaneseFood.Service.Products
{
    public static class Pricing
    {
        /// <summary>Same rule the storefront views use: sale price only when on sale and actually lower.</summary>
        public static decimal EffectivePrice(decimal price, decimal? salePrice, bool isOnSale)
            => isOnSale && salePrice.HasValue && salePrice.Value < price ? salePrice.Value : price;

        public static int DiscountPercent(decimal price, decimal effectivePrice)
            => price <= 0 || effectivePrice >= price ? 0 : (int)Math.Round((price - effectivePrice) / price * 100m);
    }
}
