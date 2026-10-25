using System.Globalization;
using System.Text;

namespace JapaneseFood.Service.Common
{
    public static class SlugHelper
    {
        /// <summary>"Cá hồi Nướng (Salmon)" → "ca-hoi-nuong-salmon". Returns "" when nothing Latin is left.</summary>
        public static string Slugify(string? text, int maxLength = 80)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var normalized = text.Trim().ToLowerInvariant()
                .Replace('đ', 'd')
                .Normalize(NormalizationForm.FormD);

            var sb = new StringBuilder(normalized.Length);
            var lastDash = true;
            foreach (var ch in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;

                if (ch is >= 'a' and <= 'z' or >= '0' and <= '9')
                {
                    sb.Append(ch);
                    lastDash = false;
                }
                else if (!lastDash)
                {
                    sb.Append('-');
                    lastDash = true;
                }
            }

            var slug = sb.ToString().Trim('-');
            if (slug.Length > maxLength) slug = slug[..maxLength].TrimEnd('-');
            return slug;
        }
    }
}
