using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Coupon
{
    [Table("Coupons")]
    public class CouponEntities : BaseEntities
    {
        public required string Code { get; set; }
        public string? Description { get; set; }
        // DiscountTypeEnum: Percentage = 1, FixedAmount = 2
        public int Type { get; set; }
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }
        // Cap for percentage coupons; null = no cap
        public decimal? MaxDiscountAmount { get; set; }
        // null = unlimited
        public int? UsageLimit { get; set; }
        public int UsedCount { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
