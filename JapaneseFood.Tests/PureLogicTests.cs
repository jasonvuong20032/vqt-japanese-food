using JapaneseFood.Common.Enums;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Settings;

namespace JapaneseFood.Tests
{
    public class PricingTests
    {
        [Theory]
        [InlineData(100_000d, 80_000d, true, 80_000d)]
        [InlineData(100_000d, 80_000d, false, 100_000d)]   // sale price ignored when not on sale
        [InlineData(100_000d, 120_000d, true, 100_000d)]   // a "sale" price above the price is ignored
        [InlineData(100_000d, null, true, 100_000d)]
        public void EffectivePrice_matches_storefront_rule(double price, double? sale, bool onSale, double expected)
            => Assert.Equal((decimal)expected, Pricing.EffectivePrice((decimal)price, (decimal?)sale, onSale));

        [Fact]
        public void DiscountPercent_rounds()
            => Assert.Equal(7, Pricing.DiscountPercent(280_000, 260_000));
    }

    public class OrderTotalsTests
    {
        private static readonly ShippingSettings Shipping = new(30_000, 500_000);

        [Fact]
        public void Charges_shipping_below_threshold()
        {
            var t = OrderService.CalculateTotals(238_000, 23_800, Shipping);
            Assert.Equal(30_000, t.ShippingFee);
            Assert.Equal(244_200, t.Total);
        }

        [Fact]
        public void Free_shipping_uses_discounted_subtotal()
        {
            Assert.Equal(0, OrderService.CalculateTotals(520_000, 0, Shipping).ShippingFee);
            // 520k - 50k discount = 470k: below the threshold again
            Assert.Equal(30_000, OrderService.CalculateTotals(520_000, 50_000, Shipping).ShippingFee);
        }

        [Fact]
        public void Discount_never_exceeds_subtotal()
        {
            var t = OrderService.CalculateTotals(40_000, 100_000, Shipping);
            Assert.Equal(40_000, t.Discount);
            Assert.Equal(30_000, t.Total);
        }

        [Fact]
        public void MergeLines_combines_duplicates_and_caps_quantity()
        {
            var lines = OrderService.MergeLines([new(1, 60), new(1, 60), new(2, 0), new(3, 2)]);
            Assert.Equal([new CartLine(1, OrderService.MaxQuantityPerLine), new CartLine(3, 2)], lines);
        }
    }

    public class CouponDiscountTests
    {
        [Fact]
        public void Percentage_coupon_is_capped()
        {
            var coupon = new CouponEntities { Code = "X", Type = (int)DiscountTypeEnum.Percentage, Value = 10, MaxDiscountAmount = 50_000 };
            Assert.Equal(23_800, CouponService.CalculateDiscount(coupon, 238_000));
            Assert.Equal(50_000, CouponService.CalculateDiscount(coupon, 900_000));
        }

        [Fact]
        public void Fixed_coupon_never_goes_negative()
        {
            var coupon = new CouponEntities { Code = "X", Type = (int)DiscountTypeEnum.FixedAmount, Value = 100_000 };
            Assert.Equal(60_000, CouponService.CalculateDiscount(coupon, 60_000));
        }
    }

    public class PhoneAndSlugTests
    {
        [Theory]
        [InlineData("0901 234 567", "0901234567")]
        [InlineData("+84 901 234 567", "0901234567")]
        [InlineData("84901234567", "0901234567")]
        [InlineData("090.123.4567", "0901234567")]
        [InlineData("123", "")]
        [InlineData("", "")]
        public void NormalizePhone(string input, string expected) => Assert.Equal(expected, OrderService.NormalizePhone(input));

        [Theory]
        [InlineData("Cá hồi Nướng (Salmon)", "ca-hoi-nuong-salmon")]
        [InlineData("Đậu phụ chiên", "dau-phu-chien")]
        [InlineData("  Wagyu A5!!  ", "wagyu-a5")]
        [InlineData("寿司", "")]
        public void Slugify(string input, string expected) => Assert.Equal(expected, SlugHelper.Slugify(input));

        [Theory]
        [InlineData("ja-JP", "ja")]
        [InlineData("FR", "fr")]
        [InlineData("de", "vi")]
        [InlineData(null, "vi")]
        public void Language_normalization(string? input, string expected) => Assert.Equal(expected, Languages.Normalize(input));
    }

    public class PasswordServiceTests
    {
        private readonly PasswordService _passwords = new();

        [Fact]
        public void Hash_roundtrip()
        {
            var hash = _passwords.Hash("Sushi2026");
            Assert.True(PasswordService.LooksHashed(hash));
            Assert.Equal(PasswordCheck.Success, _passwords.Verify(hash, "Sushi2026"));
            Assert.Equal(PasswordCheck.Failed, _passwords.Verify(hash, "sushi2026"));
        }

        [Fact]
        public void Legacy_plain_text_is_accepted_once_and_flagged_for_rehash()
        {
            Assert.Equal(PasswordCheck.SuccessRehashNeeded, _passwords.Verify("123", "123"));
            Assert.Equal(PasswordCheck.Failed, _passwords.Verify("123", "1234"));
        }

        [Fact]
        public void Knowing_a_hash_does_not_let_you_log_in_with_it()
        {
            var hash = _passwords.Hash("Sushi2026");
            Assert.Equal(PasswordCheck.Failed, _passwords.Verify(hash, hash));
        }

        [Fact]
        public void Seeded_admin_hash_verifies_default_password()
        {
            const string seeded = "AQAAAAIAAYagAAAAEPO5+ni6npNN02OxSecDOLy7LPPdxlcAdanBZ1alwSrE63VgumDy2Y9+DPENqkAYqQ==";
            Assert.Equal(PasswordCheck.Success, _passwords.Verify(seeded, "123"));
        }

        [Theory]
        [InlineData("short1", "password_too_short")]
        [InlineData("onlyletters", "password_too_weak")]
        [InlineData("12345678", "password_too_weak")]
        [InlineData("Sushi2026", null)]
        public void Strength(string pw, string? expected) => Assert.Equal(expected, _passwords.ValidateStrength(pw));
    }
}
