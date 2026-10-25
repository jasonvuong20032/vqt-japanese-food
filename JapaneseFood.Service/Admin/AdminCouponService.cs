using System.Text.RegularExpressions;
using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed class CouponInput
    {
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>1 = percentage, 2 = fixed amount (DiscountTypeEnum)</summary>
        public int Type { get; set; } = (int)DiscountTypeEnum.Percentage;
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public int? UsageLimit { get; set; }
        /// <summary>Store-local time, like the checkout's coupon check</summary>
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool IsActive { get; set; } = true;
    }

    /// <param name="State">active | scheduled | expired | used_up | disabled</param>
    public sealed record AdminCoupon(long Id, string Code, string? Description, int Type, decimal Value, decimal MinOrderAmount,
        decimal? MaxDiscountAmount, int? UsageLimit, int UsedCount, DateTime? StartsAt, DateTime? ExpiresAt, bool IsActive,
        string State, DateTime CreatedAt);

    public interface IAdminCouponService
    {
        Task<PagedResult<AdminCoupon>> ListAsync(string? search, string? state, int page, int pageSize, CancellationToken ct = default);
        Task<AdminCoupon> SaveAsync(long? id, CouponInput input, string by, CancellationToken ct = default);
        Task DeleteAsync(long id, string by, CancellationToken ct = default);
    }

    public partial class AdminCouponService(DataContext db, TimeProvider clock) : IAdminCouponService
    {
        [GeneratedRegex("^[A-Z0-9_-]{3,30}$")]
        private static partial Regex CodePattern();

        public async Task<PagedResult<AdminCoupon>> ListAsync(string? search, string? state, int page, int pageSize, CancellationToken ct = default)
        {
            (page, pageSize) = Paging.Normalize(page, pageSize, 20, 100);
            var now = clock.GetLocalNow().DateTime;
            var query = db.Coupons.AsNoTracking().Where(c => !c.IsDelete);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToUpperInvariant();
                query = query.Where(c => c.Code.Contains(term) || (c.Description != null && c.Description.Contains(search.Trim())));
            }
            // Same rules as StateOf, as SQL
            query = state switch
            {
                "disabled" => query.Where(c => !c.IsActive),
                "expired" => query.Where(c => c.IsActive && c.ExpiresAt != null && c.ExpiresAt < now),
                "used_up" => query.Where(c => c.IsActive && (c.ExpiresAt == null || c.ExpiresAt >= now) && c.UsageLimit != null && c.UsedCount >= c.UsageLimit),
                "scheduled" => query.Where(c => c.IsActive && c.StartsAt != null && c.StartsAt > now
                    && (c.ExpiresAt == null || c.ExpiresAt >= now) && (c.UsageLimit == null || c.UsedCount < c.UsageLimit)),
                "active" => query.Where(c => c.IsActive && (c.StartsAt == null || c.StartsAt <= now)
                    && (c.ExpiresAt == null || c.ExpiresAt >= now) && (c.UsageLimit == null || c.UsedCount < c.UsageLimit)),
                _ => query,
            };

            var total = await query.CountAsync(ct);
            var rows = await query.OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return new PagedResult<AdminCoupon>(rows.Select(c => ToView(c, now)).ToList(), page, pageSize, total);
        }

        public async Task<AdminCoupon> SaveAsync(long? id, CouponInput input, string by, CancellationToken ct = default)
        {
            var code = (input.Code ?? string.Empty).Trim().ToUpperInvariant();
            CouponEntities? coupon = null;
            if (id.HasValue)
                coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id && !c.IsDelete, ct)
                    ?? throw AppException.NotFound("coupon_not_found", "Coupon not found.");

            var errors = new Dictionary<string, object?>();
            if (!CodePattern().IsMatch(code)) errors["code"] = "invalid_code";
            // Codes are unique for good (deleted ones too), so an old printed code can never start working again
            else if (await db.Coupons.AnyAsync(c => c.Code == code && c.Id != (id ?? 0), ct)) errors["code"] = "duplicate";
            if (input.Type is not ((int)DiscountTypeEnum.Percentage or (int)DiscountTypeEnum.FixedAmount)) errors["type"] = "required";
            else if (input.Type == (int)DiscountTypeEnum.Percentage && (input.Value <= 0 || input.Value > 100)) errors["value"] = "percent_range";
            else if (input.Type == (int)DiscountTypeEnum.FixedAmount && input.Value <= 0) errors["value"] = "must_be_positive";
            if (input.MinOrderAmount < 0) errors["minOrderAmount"] = "must_not_be_negative";
            if (input.MaxDiscountAmount is <= 0) errors["maxDiscountAmount"] = "must_be_positive";
            if (input.UsageLimit is < 1) errors["usageLimit"] = "must_be_positive";
            else if (input.UsageLimit.HasValue && coupon is not null && input.UsageLimit < coupon.UsedCount) errors["usageLimit"] = "below_used";
            if (input.StartsAt.HasValue && input.ExpiresAt.HasValue && input.ExpiresAt <= input.StartsAt) errors["expiresAt"] = "end_before_start";
            if (input.Description?.Length > 500) errors["description"] = "too_long";
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            var now = clock.GetUtcNow().UtcDateTime;
            if (coupon is null)
            {
                coupon = new CouponEntities { Code = code, CreatedAt = now, CreatedBy = by };
                db.Coupons.Add(coupon);
            }
            coupon.Code = code;
            coupon.Description = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim();
            coupon.Type = input.Type;
            coupon.Value = input.Value;
            coupon.MinOrderAmount = input.MinOrderAmount;
            coupon.MaxDiscountAmount = input.Type == (int)DiscountTypeEnum.Percentage ? input.MaxDiscountAmount : null;
            coupon.UsageLimit = input.UsageLimit;
            coupon.StartsAt = input.StartsAt;
            coupon.ExpiresAt = input.ExpiresAt;
            coupon.IsActive = input.IsActive;
            coupon.UpdatedAt = now;
            coupon.UpdatedBy = by;
            await db.SaveChangesAsync(ct);
            return ToView(coupon, clock.GetLocalNow().DateTime);
        }

        public async Task DeleteAsync(long id, string by, CancellationToken ct = default)
        {
            var affected = await db.Coupons.Where(c => c.Id == id && !c.IsDelete)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.IsDelete, true)
                    .SetProperty(c => c.IsActive, false)
                    .SetProperty(c => c.UpdatedAt, clock.GetUtcNow().UtcDateTime)
                    .SetProperty(c => c.UpdatedBy, by), ct);
            if (affected == 0) throw AppException.NotFound("coupon_not_found", "Coupon not found.");
        }

        public static string StateOf(CouponEntities c, DateTime now) =>
            !c.IsActive ? "disabled"
            : c.ExpiresAt.HasValue && c.ExpiresAt < now ? "expired"
            : c.UsageLimit.HasValue && c.UsedCount >= c.UsageLimit ? "used_up"
            : c.StartsAt.HasValue && c.StartsAt > now ? "scheduled"
            : "active";

        private static AdminCoupon ToView(CouponEntities c, DateTime now) => new(c.Id, c.Code, c.Description, c.Type, c.Value,
            c.MinOrderAmount, c.MaxDiscountAmount, c.UsageLimit, c.UsedCount, c.StartsAt, c.ExpiresAt, c.IsActive, StateOf(c, now), c.CreatedAt);
    }
}
