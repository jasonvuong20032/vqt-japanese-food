using System.Globalization;
using System.Text;

namespace JapaneseFood.Service.Search
{
    /// <summary>
    /// Folds text for matching: lower-case, Vietnamese/French accents removed (đ → d), whitespace collapsed.
    /// Japanese and Korean characters are kept, so "寿司" and "스시" still match themselves.
    /// The same function runs on stored text and on queries, so both sides always agree.
    /// </summary>
    public static class SearchNormalizer
    {
        public static string Normalize(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var decomposed = text.Trim().ToLowerInvariant()
                .Replace('đ', 'd')
                .Normalize(NormalizationForm.FormD);

            var sb = new StringBuilder(decomposed.Length);
            var lastSpace = false;
            foreach (var ch in decomposed)
            {
                var category = CharUnicodeInfo.GetUnicodeCategory(ch);
                if (category == UnicodeCategory.NonSpacingMark) continue;

                if (char.IsWhiteSpace(ch) || ch is ',' or ';' or '/' or '(' or ')' or '-' or '_' or '.' or '&' or '+')
                {
                    if (!lastSpace && sb.Length > 0) sb.Append(' ');
                    lastSpace = true;
                    continue;
                }
                if (ch == '|') continue; // reserved as the name separator in SearchName
                sb.Append(ch);
                lastSpace = false;
            }
            return sb.ToString().Trim().Normalize(NormalizationForm.FormC);
        }

        /// <summary>Normalized query split into at most 6 terms.</summary>
        public static IReadOnlyList<string> Terms(string? query)
            => Normalize(query)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Distinct()
                .Take(6)
                .ToList();
    }
}
