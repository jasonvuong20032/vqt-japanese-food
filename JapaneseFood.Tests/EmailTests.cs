using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Email;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Settings;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace JapaneseFood.Tests
{
    public class EmailTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();
        private readonly FakeEmailQueue _emails = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());
        private readonly long[] _ids;

        public EmailTests() => _ids = _db.SeedProducts(("Sashimi Otoro", 890_000, null, 10));

        public void Dispose() => _db.Dispose();

        private static readonly StoreInfo Store = new("VQT Japanese Food", "0900 000 000", "shop@example.com", "Hồ Chí Minh", "10:00 - 22:00",
            30_000, 500_000, "https://vqt.example");

        private OrderService Orders(DataContext ctx) => new(ctx, new CouponService(ctx, _clock), new StoreSettingsService(ctx, _cache, _clock),
            _emails, _clock, NullLogger<OrderService>.Instance);

        private async Task<PlacedOrder> Place(DataContext ctx, string lang, string name = "Khách A", string? note = null)
            => await Orders(ctx).PlaceOrderAsync(new PlaceOrderRequest
            {
                Items = [new CartLine(_ids[0], 1)], FullName = name, Phone = "0901234567", Email = "guest@example.com",
                Street = "1 Lê Lợi", Province = "Hồ Chí Minh", Note = note, PaymentMethod = (int)EnumCommons.PaymentMethod.Cod,
            }, new OrderCustomer(null, null), lang);

        [Theory]
        [InlineData("vi", "Xác nhận đơn hàng", "890.000 ₫", "Theo dõi đơn hàng")]
        [InlineData("en", "confirmed", "₫890,000", "Track your order")]
        [InlineData("ja", "承りました", "₫890,000", "注文状況を確認")]
        [InlineData("ko", "접수 완료", "₫890,000", "주문 조회")]
        [InlineData("fr", "confirmée", "890 000 ₫", "Suivre ma commande")]
        public async Task Order_email_speaks_the_customers_language(string lang, string subjectPart, string money, string button)
        {
            using var ctx = _db.NewContext();
            await Place(ctx, lang);

            var mail = Assert.Single(_emails.Sent);
            Assert.Contains(subjectPart, mail.Subject);
            Assert.Contains($"lang=\"{lang}\"", mail.HtmlBody);
            Assert.Contains(button, mail.HtmlBody);
            // Free delivery above 500.000 and the localized money format
            Assert.Contains(money.Replace(" ", ""), mail.HtmlBody.Replace(" ", "").Replace(" ", ""));
        }

        [Fact]
        public async Task Status_update_uses_the_language_the_order_was_placed_in()
        {
            using var ctx = _db.NewContext();
            var placed = await Place(ctx, "ja");
            _emails.Sent.Clear();

            await Orders(_db.NewContext()).UpdateStatusAsync(placed.Id, (int)EnumCommons.OrderStatus.Confirmed, "まもなく調理します", "admin");

            var mail = Assert.Single(_emails.Sent);
            Assert.Contains("確認済み", mail.Subject);
            Assert.Contains("まもなく調理します", mail.HtmlBody);
        }

        [Fact]
        public void Customer_input_is_encoded_and_the_track_link_is_escaped()
        {
            var message = EmailTemplates.OrderStatusChanged("x@example.com", "JF1 2&3", "<script>alert(1)</script>", "0901 234", 4,
                "<img src=x onerror=alert(1)>", Store, "en");

            Assert.DoesNotContain("<script>", message.HtmlBody);
            Assert.DoesNotContain("<img src=x", message.HtmlBody);
            Assert.Contains("&lt;script&gt;", message.HtmlBody);
            Assert.Contains("https://vqt.example/track?code=JF1%202%263&amp;phone=0901%20234", message.HtmlBody);
            Assert.Contains("prefers-color-scheme: dark", message.HtmlBody);
        }

        [Fact]
        public void No_track_button_without_a_valid_website_address_and_unknown_languages_fall_back_to_vietnamese()
        {
            var message = EmailTemplates.Code("x@example.com", "An", "123456", CodePurpose.PasswordReset, TimeSpan.FromMinutes(30),
                Store with { PublicUrl = "not a url" }, "de");
            Assert.Contains("Mã đặt lại mật khẩu", message.Subject);
            Assert.Contains("30 phút", message.HtmlBody);
            Assert.DoesNotContain("/track?", message.HtmlBody);
        }

        [Fact]
        public async Task Activation_and_reset_codes_follow_the_visitors_language()
        {
            using var ctx = _db.NewContext();
            var auth = new AuthService(ctx, new PasswordService(), _emails, new StoreSettingsService(ctx, _cache, _clock), _clock, NullLogger<AuthService>.Instance);

            // The register form sends the language it shows; that wins over the request header
            await auth.RegisterAsync(new RegisterRequest { Email = "ko@example.com", Password = "Sushi2026", FullName = "Kim", Phone = "0901234567", Language = "ko" }, "en");
            Assert.Contains("계정 활성화 코드", _emails.Sent[^1].Subject);
            Assert.Equal("ko", ctx.Users.Single(u => u.UserName == "ko@example.com").PreferredLanguage);

            await auth.ResendActivationAsync("ko@example.com", "fr");
            Assert.Contains("code d'activation", _emails.Sent[^1].Subject);
        }
    }
}
