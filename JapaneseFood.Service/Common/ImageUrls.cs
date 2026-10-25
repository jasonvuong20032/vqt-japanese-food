namespace JapaneseFood.Service.Common
{
    public static class ImageUrls
    {
        /// <summary>The MVC app stores "~/Uploads/Product/x.jpg"; the API serves it at "/Uploads/Product/x.jpg".</summary>
        public static string? ToPublic(string? stored)
        {
            if (string.IsNullOrWhiteSpace(stored)) return null;
            if (stored.StartsWith("~/", StringComparison.Ordinal)) return stored[1..];
            if (stored.StartsWith("http", StringComparison.OrdinalIgnoreCase) || stored.StartsWith('/')) return stored;
            return "/" + stored;
        }
    }
}
