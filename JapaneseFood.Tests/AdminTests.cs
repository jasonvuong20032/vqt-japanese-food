using System.Text.Json;
using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Product;
using JapaneseFood.Entity.User;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Ai;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Policies;
using JapaneseFood.Service.Reviews;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace JapaneseFood.Tests
{
    public class AdminCustomerTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();
        private readonly PasswordService _passwords = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());

        public void Dispose() => _db.Dispose();

        private long AddUser(string email, EnumCommons.ERoleType role, string password = "Sushi2026")
        {
            using var ctx = _db.NewContext();
            var user = new UserEntities
            {
                UserName = email, Password = _passwords.Hash(password), FullName = email.Split('@')[0], PhoneNumber = "0901234567",
                IsActive = true, RoleId = (int)role, CreatedAt = TestClock.Now,
            };
            ctx.Users.Add(user);
            ctx.SaveChanges();
            return user.Id;
        }

        private (AdminCustomerService Customers, RefreshTokenService Tokens, AuthService Auth, UserAccessCache Access) Services(DataContext ctx)
        {
            var settings = new StoreSettingsService(ctx, _cache, _clock);
            var tokens = new RefreshTokenService(ctx, _clock, NullLogger<RefreshTokenService>.Instance);
            var access = new UserAccessCache(ctx, _cache);
            var orders = new OrderService(ctx, new CouponService(ctx, _clock), settings, new FakeEmailQueue(), _clock, NullLogger<OrderService>.Instance);
            return (new AdminCustomerService(ctx, orders, tokens, access), tokens,
                new AuthService(ctx, _passwords, new FakeEmailQueue(), settings, _clock, NullLogger<AuthService>.Instance), access);
        }

        [Fact]
        public async Task Locked_account_cannot_sign_in_refresh_or_reach_the_back_office()
        {
            var adminId = AddUser("boss@example.com", EnumCommons.ERoleType.Admin);
            var staffId = AddUser("staff@example.com", EnumCommons.ERoleType.Staff);
            using var ctx = _db.NewContext();
            var (customers, tokens, auth, access) = Services(ctx);
            var session = await tokens.IssueAsync(staffId, TimeSpan.FromDays(1));
            Assert.Equal("Staff", (await access.GetAsync(staffId)).Role); // warm the cache

            await customers.SetLockedAsync(staffId, true, adminId);

            Assert.Equal("account_locked", (await Assert.ThrowsAsync<AppException>(() =>
                auth.LoginAsync(new LoginRequest { Email = "staff@example.com", Password = "Sushi2026" }))).Code);
            Assert.Equal(RefreshOutcome.Invalid, (await tokens.RotateAsync(session.Token, TimeSpan.FromDays(1))).Outcome);
            Assert.Null(await auth.GetUserAsync(staffId));
            Assert.False((await access.GetAsync(staffId)).CanSignIn); // cache was invalidated, not served stale

            await customers.SetLockedAsync(staffId, false, adminId);
            await auth.LoginAsync(new LoginRequest { Email = "staff@example.com", Password = "Sushi2026" });
        }

        [Fact]
        public async Task Nobody_changes_themselves_and_the_last_admin_stays()
        {
            using var ctx = _db.NewContext();
            // The schema seeds admin@gmail.com; make it the only active admin for this test
            await ctx.Users.Where(u => u.RoleId == (int)EnumCommons.ERoleType.Admin).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsLocked, true));
            var onlyAdmin = AddUser("only@example.com", EnumCommons.ERoleType.Admin);
            var staff = AddUser("staff@example.com", EnumCommons.ERoleType.Staff);
            var (customers, _, _, _) = Services(ctx);

            Assert.Equal("cannot_change_self", (await Assert.ThrowsAsync<AppException>(() => customers.SetLockedAsync(onlyAdmin, true, onlyAdmin))).Code);
            Assert.Equal("cannot_change_self", (await Assert.ThrowsAsync<AppException>(() => customers.SetRoleAsync(onlyAdmin, "Staff", onlyAdmin))).Code);
            Assert.Equal("last_admin", (await Assert.ThrowsAsync<AppException>(() => customers.SetRoleAsync(onlyAdmin, "Customer", staff))).Code);
            Assert.Equal("last_admin", (await Assert.ThrowsAsync<AppException>(() => customers.SetLockedAsync(onlyAdmin, true, staff))).Code);
            Assert.Equal("invalid_role", (await Assert.ThrowsAsync<AppException>(() => customers.SetRoleAsync(staff, "Owner", onlyAdmin))).Code);
        }

        [Fact]
        public async Task Role_change_signs_the_user_out_and_shows_in_access_checks()
        {
            var adminId = AddUser("boss@example.com", EnumCommons.ERoleType.Admin);
            var userId = AddUser("cook@example.com", EnumCommons.ERoleType.Customer);
            using var ctx = _db.NewContext();
            var (customers, tokens, _, access) = Services(ctx);
            var session = await tokens.IssueAsync(userId, TimeSpan.FromDays(1));
            Assert.Equal("Customer", (await access.GetAsync(userId)).Role);

            var found = await customers.FindByEmailAsync(" COOK@example.com ");
            await customers.SetRoleAsync(found, "Staff", adminId);

            Assert.Equal("Staff", (await access.GetAsync(userId)).Role);
            Assert.Equal(RefreshOutcome.Invalid, (await tokens.RotateAsync(session.Token, TimeSpan.FromDays(1))).Outcome);
            Assert.Equal("user_not_found", (await Assert.ThrowsAsync<AppException>(() => customers.FindByEmailAsync("nobody@example.com"))).Code);
        }

        [Fact]
        public async Task Spend_ignores_cancelled_orders()
        {
            var userId = AddUser("eater@example.com", EnumCommons.ERoleType.Customer);
            var ids = _db.SeedProducts(("Sashimi", 200_000, null, 10));
            using var ctx = _db.NewContext();
            var orders = new OrderService(ctx, new CouponService(ctx, _clock), new StoreSettingsService(ctx, _cache, _clock), new FakeEmailQueue(), _clock,
                NullLogger<OrderService>.Instance);
            PlaceOrderRequest Order() => new()
            {
                Items = [new CartLine(ids[0], 3)], FullName = "Eater", Phone = "0901234567", Street = "1 Lê Lợi", Province = "Hồ Chí Minh",
                PaymentMethod = (int)EnumCommons.PaymentMethod.Cod,
            };
            await orders.PlaceOrderAsync(Order(), new OrderCustomer(userId, "eater@example.com"), "vi");
            var cancelled = await orders.PlaceOrderAsync(Order(), new OrderCustomer(userId, "eater@example.com"), "vi");
            await orders.UpdateStatusAsync(cancelled.Id, (int)EnumCommons.OrderStatus.Cancelled, null, "admin");

            var (customers, _, _, _) = Services(_db.NewContext());
            var row = (await customers.ListAsync(new AdminCustomerQuery { Search = "eater" })).Items.Single();

            Assert.Equal(2, row.OrderCount);
            Assert.Equal(600_000, row.TotalSpent); // 3 x 200.000, the cancelled order isn't spend (free shipping above 500k)
            var detail = await customers.GetAsync(userId);
            Assert.Equal(2, detail!.RecentOrders.Count);
        }
    }

    public class AdminCouponTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();

        public void Dispose() => _db.Dispose();

        private AdminCouponService Service(DataContext ctx) => new(ctx, _clock);

        private static CouponInput Valid(string code = "SUMMER10") => new()
        {
            Code = code, Type = (int)DiscountTypeEnum.Percentage, Value = 10, MinOrderAmount = 200_000, MaxDiscountAmount = 50_000, IsActive = true,
        };

        [Fact]
        public async Task Validates_codes_values_and_dates()
        {
            using var ctx = _db.NewContext();
            var service = Service(ctx);
            var bad = Valid("no spaces!");
            bad.Value = 150;
            bad.StartsAt = TestClock.Now.AddDays(5);
            bad.ExpiresAt = TestClock.Now.AddDays(1);
            var ex = await Assert.ThrowsAsync<AppException>(() => service.SaveAsync(null, bad, "admin"));
            Assert.Equal("validation_failed", ex.Code);
            Assert.Equal("invalid_code", ex.Details!["code"]);
            Assert.Equal("percent_range", ex.Details["value"]);
            Assert.Equal("end_before_start", ex.Details["expiresAt"]);
        }

        [Fact]
        public async Task Codes_are_normalised_and_never_reused_even_after_delete()
        {
            using var ctx = _db.NewContext();
            var service = Service(ctx);
            var created = await service.SaveAsync(null, Valid(" summer10 "), "admin");
            Assert.Equal("SUMMER10", created.Code);
            Assert.Equal("active", created.State);

            await service.DeleteAsync(created.Id, "admin");
            var ex = await Assert.ThrowsAsync<AppException>(() => service.SaveAsync(null, Valid(), "admin"));
            Assert.Equal("duplicate", ex.Details!["code"]);
            Assert.Empty((await service.ListAsync(null, null, 1, 20)).Items);
        }

        [Fact]
        public async Task State_follows_dates_usage_and_switch()
        {
            using var ctx = _db.NewContext();
            var service = Service(ctx);
            var scheduled = Valid("LATER");
            scheduled.StartsAt = _clock.GetLocalNow().DateTime.AddDays(2);
            var expired = Valid("OLD");
            expired.ExpiresAt = _clock.GetLocalNow().DateTime.AddDays(-1);
            var off = Valid("OFF");
            off.IsActive = false;
            await service.SaveAsync(null, scheduled, "admin");
            await service.SaveAsync(null, expired, "admin");
            await service.SaveAsync(null, off, "admin");
            await service.SaveAsync(null, Valid("NOW"), "admin");

            var all = (await service.ListAsync(null, null, 1, 20)).Items.ToDictionary(c => c.Code, c => c.State);
            Assert.Equal("scheduled", all["LATER"]);
            Assert.Equal("expired", all["OLD"]);
            Assert.Equal("disabled", all["OFF"]);
            Assert.Equal("active", all["NOW"]);
            Assert.Equal(["NOW"], (await service.ListAsync(null, "active", 1, 20)).Items.Select(c => c.Code));

            // An admin-created coupon works at checkout
            var applied = await new CouponService(ctx, _clock).ApplyAsync("now", 300_000);
            Assert.Equal(30_000, applied.DiscountAmount);
        }
    }

    public class AdminContentTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());

        public void Dispose() => _db.Dispose();

        [Fact]
        public async Task Hiding_a_review_updates_the_product_rating()
        {
            var ids = _db.SeedProducts(("Mochi", 50_000, null, 10));
            using var ctx = _db.NewContext();
            var buyer = ctx.Users.Single(u => u.Id == 1).Id;
            // One review per customer per dish, so the spam comes from a second account
            var spammer = new UserEntities
            {
                UserName = "spam@example.com", Password = "x", FullName = "Spam", PhoneNumber = "0900000000", IsActive = true,
                RoleId = (int)EnumCommons.ERoleType.Customer, CreatedAt = TestClock.Now,
            };
            ctx.Users.Add(spammer);
            ctx.SaveChanges();
            ctx.Reviews.AddRange(
                new ReviewEntities { ProductId = ids[0], UserId = buyer, Rating = 5, IsApproved = true, CreatedAt = TestClock.Now },
                new ReviewEntities { ProductId = ids[0], UserId = spammer.Id, Rating = 1, Comment = "spam spam", IsApproved = true, CreatedAt = TestClock.Now });
            ctx.SaveChanges();
            var reviewService = new ReviewService(ctx, _clock);
            await reviewService.RefreshProductRatingAsync(ids[0]);
            var admin = new AdminReviewService(ctx, reviewService, _clock);

            var spam = (await admin.ListAsync(null, 1, "spam", 1, 20)).Items.Single();
            Assert.Equal(1, await admin.SetVisibleAsync([spam.Id], false, "staff"));

            using var read = _db.NewContext();
            var product = read.Products.Single(p => p.Id == ids[0]);
            Assert.Equal((5, 1), (product.Rating, product.ReviewCount));
            Assert.Single((await new AdminReviewService(read, new ReviewService(read, _clock), _clock).ListAsync("hidden", null, null, 1, 20)).Items);
        }

        [Fact]
        public async Task Policies_keep_translations_and_feed_the_storefront()
        {
            using var ctx = _db.NewContext();
            var admin = new AdminPolicyService(ctx, _clock);
            var saved = await admin.SaveAsync(null, new PolicyInput
            {
                Topic = " Delivery ", Title = "Giao hàng", Content = "Giao trong 60–90 phút.", IsActive = true,
                Translations = new() { ["ja"] = new PolicyText { Title = "配達", Content = "60〜90分でお届けします。" }, ["en"] = new PolicyText() },
            }, "admin");

            Assert.Equal("delivery", saved.Topic);
            Assert.Equal(["ja"], saved.Translations.Keys); // an empty translation is "not translated", not saved

            var policies = new StorePolicyService(_db.NewContext());
            Assert.Equal("配達", (await policies.GetAllAsync("ja")).Single(p => p.Id == saved.Id).Title);
            Assert.Equal("Giao hàng", (await policies.GetAllAsync("en")).Single(p => p.Id == saved.Id).Title);

            var ex = await Assert.ThrowsAsync<AppException>(() => admin.SaveAsync(null, new PolicyInput { Topic = "x", Title = "", Content = "" }, "admin"));
            Assert.Equal(["content", "title"], ex.Details!.Keys.Order());
        }

        [Fact]
        public async Task Settings_are_validated_and_round_trip()
        {
            using var ctx = _db.NewContext();
            var admin = new AdminSettingsService(new StoreSettingsService(ctx, _cache, _clock));
            var current = await admin.GetAsync();
            current.ShippingFee = 25_000;
            current.FreeShippingThreshold = 400_000;
            current.OpeningHours = "09:00 - 22:00";
            var saved = await admin.SaveAsync(current);
            Assert.Equal((25_000m, 400_000m, "09:00 - 22:00"), (saved.ShippingFee, saved.FreeShippingThreshold, saved.OpeningHours));
            Assert.Equal(25_000, (await new StoreSettingsService(_db.NewContext(), new MemoryCache(new MemoryCacheOptions()), _clock).GetShippingAsync()).Fee);

            current.StoreEmail = "not-an-email";
            current.ShippingFee = -1;
            var ex = await Assert.ThrowsAsync<AppException>(() => admin.SaveAsync(current));
            Assert.Equal("invalid_email", ex.Details!["storeEmail"]);
            Assert.Equal("must_not_be_negative", ex.Details["shippingFee"]);
        }
    }

    public class AiTranslatorTests
    {
        private static AiTranslator Translator() => new(new AnthropicClientProvider(new ConfigurationBuilder().Build()),
            Options.Create(new AiOptions()), NullLogger<AiTranslator>.Instance);

        [Fact]
        public async Task Refuses_bad_requests_before_calling_the_api()
        {
            var t = Translator();
            Assert.False(t.IsConfigured);
            Assert.Equal("nothing_to_translate", (await Assert.ThrowsAsync<AppException>(() =>
                t.TranslateAsync(new TranslateRequest("dish", new Dictionary<string, string> { ["name"] = " ", ["price"] = "1" }, ["en"])))).Code);
            Assert.Equal("invalid_language", (await Assert.ThrowsAsync<AppException>(() =>
                t.TranslateAsync(new TranslateRequest("dish", new Dictionary<string, string> { ["name"] = "Mochi" }, ["vi", "de"])))).Code);
            Assert.Equal("invalid_kind", (await Assert.ThrowsAsync<AppException>(() =>
                t.TranslateAsync(new TranslateRequest("email", new Dictionary<string, string> { ["name"] = "Mochi" }, ["en"])))).Code);
            // Valid but no key configured: a clean 503 instead of a crash
            var ex = await Assert.ThrowsAsync<AppException>(() =>
                t.TranslateAsync(new TranslateRequest("dish", new Dictionary<string, string> { ["name"] = "Mochi" }, ["en"])));
            Assert.Equal((503, "ai_unavailable"), (ex.StatusCode, ex.Code));
        }

        [Fact]
        public void Request_asks_for_strict_json_per_language_with_fallback()
        {
            var fields = new Dictionary<string, string> { ["name"] = "Mochi kem matcha", ["shortDescription"] = "Mochi dẻo nhân kem" };
            using var doc = JsonDocument.Parse(Translator().BuildParams("dish", fields, ["en", "ja"]).ToString());
            var body = doc.RootElement.GetProperty("BodyData");

            Assert.Equal("default", body.GetProperty("fallbacks").GetString());
            Assert.Equal("medium", body.GetProperty("output_config").GetProperty("effort").GetString());
            var schema = body.GetProperty("output_config").GetProperty("format").GetProperty("schema");
            Assert.Equal(["en", "ja"], schema.GetProperty("required").EnumerateArray().Select(e => e.GetString()));
            var en = schema.GetProperty("properties").GetProperty("en");
            Assert.False(en.GetProperty("additionalProperties").GetBoolean());
            Assert.Equal(["name", "shortDescription"], en.GetProperty("required").EnumerateArray().Select(e => e.GetString()));
            Assert.Contains("Mochi kem matcha", body.GetProperty("messages")[0].GetProperty("content").GetString());
        }

        [Fact]
        public void Parses_the_answer_and_rejects_garbage()
        {
            var result = AiTranslator.Parse("""{"en":{"name":" Matcha ice-cream mochi "},"ja":{"name":"抹茶アイス大福"}}""", ["name"], ["en", "ja"]);
            Assert.Equal("Matcha ice-cream mochi", result.Translations["en"]["name"]);
            Assert.Equal("抹茶アイス大福", result.Translations["ja"]["name"]);
            Assert.Equal("ai_failed", Assert.Throws<AppException>(() => AiTranslator.Parse("not json", ["name"], ["en"])).Code);
        }
    }
}
