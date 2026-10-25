using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Policies
{
    public sealed record PolicyView(long Id, string Topic, string Title, string Content);

    public interface IStorePolicyService
    {
        Task<IReadOnlyList<PolicyView>> GetAllAsync(string lang, CancellationToken ct = default);
    }

    public class StorePolicyService(DataContext db) : IStorePolicyService
    {
        public async Task<IReadOnlyList<PolicyView>> GetAllAsync(string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            return await db.StorePolicies.AsNoTracking()
                .Where(p => !p.IsDelete && p.IsActive)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
                .Select(p => new PolicyView(
                    p.Id,
                    p.Topic,
                    p.Translations.Where(t => t.LanguageCode == lang).Select(t => t.Title).FirstOrDefault() ?? p.Title,
                    p.Translations.Where(t => t.LanguageCode == lang).Select(t => t.Content).FirstOrDefault() ?? p.Content))
                .ToListAsync(ct);
        }
    }
}
