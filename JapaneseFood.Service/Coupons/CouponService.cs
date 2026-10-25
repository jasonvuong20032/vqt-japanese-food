using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Coupons
{
    public sealed record AppliedCoupon(long Id, string Code, decimal DiscountAmount);

    public interface ICouponService
    {
        /// <summary>Validates <paramref name="code"/> against <paramref name="subtotal"/>; throws <see cref="AppException"/> when unusable.</summary>
        Task<AppliedCoupon> ApplyAsync(string code, decimal subtotal, CancellationToken ct = default);
    }

    public class CouponService(DataContext db, TimeProvider clock) : ICouponService
    {
        public async Task<AppliedCoupon> ApplyAsync(string code, decimal subtotal, CancellationToken ct = default)
        {
            var normalized = code.Trim().ToUpperInvariant();
            var coupon = await db.Coupons.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == normalized && !c.IsDelete && c.IsActive, ct)
                ?? throw AppException.BadRequest("coupon_invalid", "Coupon code is not valid.");

            var now = clock.GetLocalNow().DateTime;
            if (coupon.StartsAt.HasValue && now < coupon.StartsAt.Value)
                throw AppException.BadRequest("coupon_not_started", "Coupon is not active yet.");
            if (coupon.ExpiresAt.HasValue && now > coupon.ExpiresAt.Value)
                throw AppException.BadRequest("coupon_expired", "Coupon has expired.");
            if (coupon.UsageLimit.HasValue && coupon.UsedCount >= coupon.UsageLimit.Value)
                throw AppException.BadRequest("coupon_used_up", "Coupon has been fully redeemed.");
            if (subtotal < coupon.MinOrderAmount)
                throw AppException.BadRequest("coupon_min_order", "Order total is below the coupon minimum.",
                    new Dictionary<string, object?> { ["minOrderAmount"] = coupon.MinOrderAmount });

            return new AppliedCoupon(coupon.Id, coupon.Code, CalculateDiscount(coupon, subtotal));
        }

        public static decimal CalculateDiscount(CouponEntities coupon, decimal subtotal)
        {
            decimal discount = coupon.Type == (int)DiscountTypeEnum.Percentage
                ? Math.Round(subtotal * coupon.Value / 100m, 0, MidpointRounding.AwayFromZero)
                : coupon.Value;

            if (coupon.MaxDiscountAmount.HasValue) discount = Math.Min(discount, coupon.MaxDiscountAmount.Value);
            return Math.Clamp(discount, 0, subtotal);
        }
    }
}
