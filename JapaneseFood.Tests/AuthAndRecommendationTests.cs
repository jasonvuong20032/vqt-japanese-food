using JapaneseFood.Common.Enums;
using JapaneseFood.Entity.Order;
using JapaneseFood.Entity.User;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Recommendations;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace JapaneseFood.Tests
{
    public class AuthServiceTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();
        private readonly FakeEmailQueue _emails = new();
        private readonly PasswordService _passwords = new();

        public void Dispose() => _db.Dispose();

        private AuthService NewService(JapaneseFood.Entity.DataContext ctx)
            => new(ctx, _passwords, _emails, new StoreSettingsService(ctx, new MemoryCache(new MemoryCacheOptions()), _clock),
                _clock, NullLogger<AuthService>.Instance);

        [Fact]
        public async Task Register_activate_login_flow()
        {
            using var ctx = _db.NewContext();
            var auth = NewService(ctx);
            await auth.RegisterAsync(new RegisterRequest { Email = "Guest@Example.com", Password = "Sushi2026", FullName = "Khách", Phone = "0901234567" });

            Assert.Equal("account_not_active", (await Assert.ThrowsAsync<AppException>(() =>
                auth.LoginAsync(new LoginRequest { Email = "guest@example.com", Password = "Sushi2026" }))).Code);

            var user = await ctx.Users.SingleAsync(u => u.UserName == "guest@example.com");
            Assert.NotEqual("Sushi2026", user.Password);
            Assert.Single(_emails.Sent);
            Assert.Contains(user.ActivationCode!, _emails.Sent[0].HtmlBody);

            Assert.Equal("activation_invalid", (await Assert.ThrowsAsync<AppException>(() =>
                auth.ActivateAsync(new ActivateRequest { Email = "guest@example.com", Code = "000000x" }))).Code);
            await auth.ActivateAsync(new ActivateRequest { Email = "guest@example.com", Code = user.ActivationCode! });

            var loggedIn = await auth.LoginAsync(new LoginRequest { Email = "GUEST@example.com", Password = "Sushi2026" });
            Assert.Equal("Customer", loggedIn.Role);
        }

        [Fact]
        public async Task Activation_code_expires()
        {
            using var ctx = _db.NewContext();
            var auth = NewService(ctx);
            await auth.RegisterAsync(new RegisterRequest { Email = "late@example.com", Password = "Sushi2026", FullName = "Late", Phone = "0901234567" });
            var code = (await ctx.Users.SingleAsync(u => u.UserName == "late@example.com")).ActivationCode!;

            _clock.Current = _clock.Current.AddMinutes(31);
            Assert.Equal("activation_expired", (await Assert.ThrowsAsync<AppException>(() =>
                auth.ActivateAsync(new ActivateRequest { Email = "late@example.com", Code = code }))).Code);
        }

        [Fact]
        public async Task Legacy_plain_text_password_is_upgraded_on_login()
        {
            using var ctx = _db.NewContext();
            ctx.Users.Add(new UserEntities
            {
                UserName = "old@example.com", Password = "abc123", FullName = "Old", PhoneNumber = "0901234567",
                IsActive = true, RoleId = (int)EnumCommons.ERoleType.Customer, CreatedAt = TestClock.Now,
            });
            await ctx.SaveChangesAsync();

            await NewService(ctx).LoginAsync(new LoginRequest { Email = "old@example.com", Password = "abc123" });

            using var check = _db.NewContext();
            var stored = (await check.Users.SingleAsync(u => u.UserName == "old@example.com")).Password;
            Assert.True(PasswordService.LooksHashed(stored));
        }

        [Fact]
        public async Task Refresh_token_reuse_revokes_every_session()
        {
            using var ctx = _db.NewContext();
            var tokens = new RefreshTokenService(ctx, _clock, NullLogger<RefreshTokenService>.Instance);
            var first = await tokens.IssueAsync(42, TimeSpan.FromDays(30));

            var rotated = await tokens.RotateAsync(first.Token, TimeSpan.FromDays(30));
            Assert.Equal(RefreshOutcome.Rotated, rotated.Outcome);

            // Minutes later an attacker replays the old token: refused, and the legitimate new token dies too
            _clock.Current = _clock.Current.AddMinutes(5);
            Assert.Equal(RefreshOutcome.Invalid, (await tokens.RotateAsync(first.Token, TimeSpan.FromDays(30))).Outcome);
            Assert.Equal(RefreshOutcome.Invalid, (await tokens.RotateAsync(rotated.Token!.Token, TimeSpan.FromDays(30))).Outcome);
        }

        [Fact]
        public async Task Two_tabs_refreshing_at_once_do_not_log_the_user_out()
        {
            using var ctx = _db.NewContext();
            var tokens = new RefreshTokenService(ctx, _clock, NullLogger<RefreshTokenService>.Instance);
            var first = await tokens.IssueAsync(42, TimeSpan.FromDays(30));

            var winner = await tokens.RotateAsync(first.Token, TimeSpan.FromDays(30));
            var loser = await tokens.RotateAsync(first.Token, TimeSpan.FromDays(30));

            Assert.Equal(RefreshOutcome.Superseded, loser.Outcome);
            Assert.Equal(RefreshOutcome.Rotated, (await tokens.RotateAsync(winner.Token!.Token, TimeSpan.FromDays(30))).Outcome);
        }

        [Fact]
        public async Task Logged_out_token_cannot_refresh()
        {
            using var ctx = _db.NewContext();
            var tokens = new RefreshTokenService(ctx, _clock, NullLogger<RefreshTokenService>.Instance);
            var issued = await tokens.IssueAsync(42, TimeSpan.FromDays(30));
            await tokens.RevokeAsync(issued.Token);
            Assert.Equal(RefreshOutcome.Invalid, (await tokens.RotateAsync(issued.Token, TimeSpan.FromDays(30))).Outcome);
        }
    }

    public class RecommendationTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();

        public void Dispose() => _db.Dispose();

        [Fact]
        public async Task Ranks_recent_sales_ignores_cancelled_and_falls_back_to_all_time()
        {
            var ids = _db.SeedProducts(("A", 10_000, null, 50), ("B", 10_000, null, 50), ("C", 10_000, null, 50), ("D", 10_000, null, 50));

            using (var ctx = _db.NewContext())
            {
                void AddOrder(int status, int daysAgo, params (long Id, int Qty)[] lines)
                {
                    var o = new OrderEntities
                    {
                        Code = Guid.NewGuid().ToString("N")[..12], Status = status, IsActive = true,
                        CreatedAt = TestClock.Now.AddDays(-daysAgo),
                        Details = lines.Select(l => new OrderDetailEntities { ProductId = l.Id, Quantity = l.Qty }).ToList(),
                    };
                    ctx.Orders.Add(o);
                }

                AddOrder((int)EnumCommons.OrderStatus.Delivered, 2, (ids[1], 5), (ids[2], 1));
                AddOrder((int)EnumCommons.OrderStatus.Pending, 1, (ids[2], 2));
                AddOrder((int)EnumCommons.OrderStatus.Cancelled, 1, (ids[0], 100));  // must not count
                AddOrder((int)EnumCommons.OrderStatus.Delivered, 90, (ids[0], 100)); // outside the 30-day window
                await ctx.SaveChangesAsync();

                // All-time counter used as the fallback ranking
                await ctx.Products.Where(p => p.Id == ids[3]).ExecuteUpdateAsync(s => s.SetProperty(p => p.SoldCount, 40));
            }

            using var read = _db.NewContext();
            var cache = new MemoryCache(new MemoryCacheOptions());
            var service = new RecommendationService(read, new ProductService(read), cache, _clock);
            var best = await service.GetBestSellersAsync(null, null, 3, "vi");

            Assert.Equal([ids[1], ids[2], ids[3]], best.Select(b => b.Product.Id));
            Assert.Equal([5, 3, 40], best.Select(b => b.UnitsSold));
        }
    }
}
