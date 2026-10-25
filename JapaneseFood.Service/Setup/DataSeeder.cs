using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Entity.Language;
using JapaneseFood.Entity.Store;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JapaneseFood.Service.Setup
{
    /// <summary>Idempotent reference data + backfills. Safe to run on every startup.</summary>
    public class DataSeeder(DataContext db, ISearchIndexer search, TimeProvider clock, ILogger<DataSeeder> logger)
    {
        public async Task SeedAsync(bool includeDemoData, CancellationToken ct = default)
        {
            await SeedLanguagesAsync(ct);
            await SeedPoliciesAsync(ct);
            await BackfillSlugsAsync(ct);
            await BackfillCatalogSlugsAsync(ct);
            await BackfillSearchIndexAsync(ct);
            if (includeDemoData) await SeedDemoCouponAsync(ct);
        }

        private async Task SeedLanguagesAsync(CancellationToken ct)
        {
            var existing = await db.Language.Select(l => l.Code).ToListAsync(ct);
            var order = 0;
            foreach (var code in Languages.Supported)
            {
                order++;
                if (existing.Contains(code)) continue;
                db.Language.Add(new LanguageEntities { Code = code, Name = Languages.NativeNames[code], National = code, SortOrder = order, IsActive = true });
            }
            await db.SaveChangesAsync(ct);
        }

        private async Task SeedPoliciesAsync(CancellationToken ct)
        {
            if (await db.StorePolicies.AnyAsync(ct)) return;
            var now = clock.GetLocalNow().DateTime;

            (string Topic, string Title, string Content, string TitleEn, string ContentEn)[] defaults =
            [
                ("shipping", "Giao hàng",
                    "Chúng tôi giao hàng trong nội thành trong 60-90 phút kể từ khi xác nhận đơn. Phí giao hàng và mức miễn phí giao hàng được hiển thị trong giỏ hàng. Món ăn được đóng gói giữ nhiệt và giao bằng túi chuyên dụng.",
                    "Delivery",
                    "We deliver within the city in 60-90 minutes after the order is confirmed. The delivery fee and the free-delivery threshold are shown in the cart. Food is packed in insulated bags."),
                ("payment", "Thanh toán",
                    "Hiện tại cửa hàng nhận thanh toán khi nhận hàng (COD). Thanh toán qua VNPay và MoMo sẽ sớm được hỗ trợ.",
                    "Payment",
                    "We currently accept cash on delivery (COD). VNPay and MoMo payments are coming soon."),
                ("cancellation", "Huỷ đơn & đổi trả",
                    "Bạn có thể tự huỷ đơn khi đơn còn ở trạng thái Chờ xác nhận. Nếu món ăn bị giao sai, thiếu hoặc không đảm bảo chất lượng, vui lòng liên hệ hotline trong vòng 2 giờ kể từ khi nhận hàng để được đổi món hoặc hoàn tiền.",
                    "Cancellation & returns",
                    "You can cancel an order yourself while it is still pending. If an item is wrong, missing or not up to standard, call our hotline within 2 hours of delivery for a replacement or refund."),
                ("opening-hours", "Giờ mở cửa",
                    "Cửa hàng mở cửa từ 10:00 đến 22:00 tất cả các ngày trong tuần, kể cả ngày lễ. Đơn đặt ngoài giờ sẽ được xử lý vào đầu ca kế tiếp.",
                    "Opening hours",
                    "We are open 10:00-22:00 every day, including public holidays. Orders placed outside these hours are handled at the start of the next shift."),
                ("freshness", "Bảo quản & an toàn thực phẩm",
                    "Sushi và sashimi nên dùng ngay trong vòng 2 giờ sau khi nhận. Món nóng có thể bảo quản tủ lạnh tối đa 24 giờ và hâm nóng trước khi dùng. Vui lòng ghi chú dị ứng (hải sản, đậu nành, mè, gluten...) khi đặt hàng.",
                    "Storage & food safety",
                    "Sushi and sashimi are best eaten within 2 hours of delivery. Hot dishes keep up to 24 hours in the fridge; reheat before eating. Please note any allergies (seafood, soy, sesame, gluten...) in the order note."),
                ("contact", "Liên hệ",
                    "Bạn có thể liên hệ cửa hàng qua hotline hoặc email hiển thị ở chân trang. Chúng tôi phản hồi trong giờ mở cửa.",
                    "Contact",
                    "Reach us via the hotline or email in the site footer. We reply during opening hours."),
            ];

            var sort = 0;
            foreach (var d in defaults)
            {
                var policy = new StorePolicyEntities
                {
                    Topic = d.Topic, Title = d.Title, Content = d.Content, SortOrder = ++sort,
                    IsActive = true, CreatedAt = now, UpdatedAt = now, CreatedBy = "system",
                };
                policy.Translations.Add(new StorePolicyTranslationEntities { LanguageCode = "en", Title = d.TitleEn, Content = d.ContentEn });
                db.StorePolicies.Add(policy);
            }
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} default store policies", defaults.Length);
        }

        private async Task BackfillSlugsAsync(CancellationToken ct)
        {
            var missing = await db.Products.Where(p => p.Slug == null || p.Slug == "").ToListAsync(ct);
            if (missing.Count == 0) return;

            var taken = new HashSet<string>(await db.Products.Where(p => p.Slug != null).Select(p => p.Slug!).ToListAsync(ct));
            foreach (var p in missing)
            {
                var baseSlug = SlugHelper.Slugify(p.Name);
                if (string.IsNullOrEmpty(baseSlug)) baseSlug = "product";
                var slug = baseSlug;
                for (var i = 2; taken.Contains(slug); i++) slug = $"{baseSlug}-{i}";
                taken.Add(slug);
                p.Slug = slug;
            }
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Generated slugs for {Count} products", missing.Count);
        }

        private async Task BackfillCatalogSlugsAsync(CancellationToken ct)
        {
            var missing = await db.Catalogs.Where(c => c.Slug == null || c.Slug == "").ToListAsync(ct);
            if (missing.Count == 0) return;

            var taken = new HashSet<string>(await db.Catalogs.Where(c => c.Slug != null).Select(c => c.Slug!).ToListAsync(ct));
            foreach (var c in missing)
            {
                var baseSlug = SlugHelper.Slugify(c.Name);
                if (string.IsNullOrEmpty(baseSlug)) baseSlug = "menu";
                var slug = baseSlug;
                for (var i = 2; taken.Contains(slug); i++) slug = $"{baseSlug}-{i}";
                taken.Add(slug);
                c.Slug = slug;
            }
            await db.SaveChangesAsync(ct);
        }

        private async Task BackfillSearchIndexAsync(CancellationToken ct)
        {
            var ids = await db.Products.Where(p => p.SearchText == null).Select(p => p.Id).ToListAsync(ct);
            if (ids.Count == 0) return;
            await search.RebuildAsync(ids, ct);
            logger.LogInformation("Built search index for {Count} products", ids.Count);
        }

        private async Task SeedDemoCouponAsync(CancellationToken ct)
        {
            if (await db.Coupons.AnyAsync(ct)) return;
            var now = clock.GetLocalNow().DateTime;
            db.Coupons.Add(new CouponEntities
            {
                Code = "WELCOME10",
                Description = "Giảm 10% (tối đa 50.000₫) cho đơn từ 200.000₫",
                Type = (int)DiscountTypeEnum.Percentage,
                Value = 10,
                MinOrderAmount = 200_000,
                MaxDiscountAmount = 50_000,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = "system",
            });
            await db.SaveChangesAsync(ct);
        }
    }
}
