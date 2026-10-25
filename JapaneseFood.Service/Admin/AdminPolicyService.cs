using JapaneseFood.Entity;
using JapaneseFood.Entity.Store;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed class PolicyText
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public sealed class PolicyInput
    {
        /// <summary>Short machine key such as "delivery", "payment", "allergy"</summary>
        public string Topic { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public Dictionary<string, PolicyText> Translations { get; set; } = [];
    }

    public sealed record AdminPolicy(long Id, string Topic, string Title, string Content, int SortOrder, bool IsActive,
        IReadOnlyDictionary<string, PolicyText> Translations, DateTime UpdatedAt);

    public interface IAdminPolicyService
    {
        Task<IReadOnlyList<AdminPolicy>> ListAsync(CancellationToken ct = default);
        Task<AdminPolicy> SaveAsync(long? id, PolicyInput input, string by, CancellationToken ct = default);
        Task DeleteAsync(long id, string by, CancellationToken ct = default);
    }

    /// <summary>Store policies and FAQ, shown on /policies.</summary>
    public class AdminPolicyService(DataContext db, TimeProvider clock) : IAdminPolicyService
    {
        public async Task<IReadOnlyList<AdminPolicy>> ListAsync(CancellationToken ct = default)
        {
            var rows = await db.StorePolicies.AsNoTracking().Include(p => p.Translations)
                .Where(p => !p.IsDelete)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
                .ToListAsync(ct);
            return rows.Select(ToView).ToList();
        }

        public async Task<AdminPolicy> SaveAsync(long? id, PolicyInput input, string by, CancellationToken ct = default)
        {
            var errors = new Dictionary<string, object?>();
            var topic = (input.Topic ?? string.Empty).Trim().ToLowerInvariant();
            if (topic.Length is 0 or > 50) errors["topic"] = "required";
            if (string.IsNullOrWhiteSpace(input.Title) || input.Title.Length > 200) errors["title"] = "required";
            if (string.IsNullOrWhiteSpace(input.Content)) errors["content"] = "required";
            else if (input.Content.Length > 8000) errors["content"] = "too_long";
            foreach (var lang in input.Translations.Keys.Where(l => !Languages.Supported.Contains(l) || l == Languages.Default))
                errors[$"translations.{lang}"] = "unsupported_language";
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            var now = clock.GetUtcNow().UtcDateTime;
            StorePolicyEntities policy;
            if (id.HasValue)
            {
                policy = await db.StorePolicies.Include(p => p.Translations).FirstOrDefaultAsync(p => p.Id == id && !p.IsDelete, ct)
                    ?? throw AppException.NotFound("policy_not_found", "Policy not found.");
                policy.Topic = topic;
                policy.Title = input.Title.Trim();
                policy.Content = input.Content.Trim();
            }
            else
            {
                policy = new StorePolicyEntities { Topic = topic, Title = input.Title.Trim(), Content = input.Content.Trim(), CreatedAt = now, CreatedBy = by };
                db.StorePolicies.Add(policy);
            }
            policy.SortOrder = input.SortOrder;
            policy.IsActive = input.IsActive;
            policy.UpdatedAt = now;
            policy.UpdatedBy = by;

            // Vietnamese lives in the base columns; a language with an empty title is "not translated" and falls back
            foreach (var lang in Languages.Supported.Where(l => l != Languages.Default))
            {
                var existing = policy.Translations.FirstOrDefault(t => t.LanguageCode == lang);
                var text = input.Translations.GetValueOrDefault(lang);
                if (text is null || string.IsNullOrWhiteSpace(text.Title) || string.IsNullOrWhiteSpace(text.Content))
                {
                    if (existing is not null) policy.Translations.Remove(existing);
                    continue;
                }
                if (existing is null)
                    policy.Translations.Add(new StorePolicyTranslationEntities { LanguageCode = lang, Title = text.Title.Trim(), Content = text.Content.Trim() });
                else
                {
                    existing.Title = text.Title.Trim();
                    existing.Content = text.Content.Trim();
                }
            }
            await db.SaveChangesAsync(ct);
            return ToView(policy);
        }

        public async Task DeleteAsync(long id, string by, CancellationToken ct = default)
        {
            var affected = await db.StorePolicies.Where(p => p.Id == id && !p.IsDelete)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.IsDelete, true)
                    .SetProperty(p => p.UpdatedAt, clock.GetUtcNow().UtcDateTime)
                    .SetProperty(p => p.UpdatedBy, by), ct);
            if (affected == 0) throw AppException.NotFound("policy_not_found", "Policy not found.");
        }

        private static AdminPolicy ToView(StorePolicyEntities p) => new(p.Id, p.Topic, p.Title, p.Content, p.SortOrder, p.IsActive,
            p.Translations.ToDictionary(t => t.LanguageCode, t => new PolicyText { Title = t.Title, Content = t.Content }), p.UpdatedAt);
    }
}
