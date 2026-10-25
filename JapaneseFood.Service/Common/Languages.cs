namespace JapaneseFood.Service.Common
{
    public static class Languages
    {
        /// <summary>Language the base columns (Products.Name, ...) are written in.</summary>
        public const string Default = "vi";

        public static readonly IReadOnlyList<string> Supported = ["vi", "en", "ja", "ko", "fr"];

        public static readonly IReadOnlyDictionary<string, string> NativeNames = new Dictionary<string, string>
        {
            ["vi"] = "Tiếng Việt",
            ["en"] = "English",
            ["ja"] = "日本語",
            ["ko"] = "한국어",
            ["fr"] = "Français",
        };

        /// <summary>Maps "ja-JP", "JA", null, "xx" ... to a supported code, falling back to <see cref="Default"/>.</summary>
        public static string Normalize(string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return Default;
            var two = code.Trim().ToLowerInvariant();
            if (two.Length > 2) two = two[..2];
            return Supported.Contains(two) ? two : Default;
        }
    }
}
