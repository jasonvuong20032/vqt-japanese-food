using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Status = JapaneseFood.Common.Enums.EnumCommons.OrderStatus;

namespace JapaneseFood.Tests
{
    public class OrderServiceTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly TestClock _clock = new();
        private readonly FakeEmailQueue _emails = new();
        private readonly long[] _ids;

        public OrderServiceTests()
        {
            _ids = _db.SeedProducts(
                ("Nigiri octopus", 79_000, 76_000, 10),
                ("Unagi sushi", 89_000, null, 3));
        }

        public void Dispose() => _db.Dispose();

        private OrderService NewService(DataContext ctx)
        {
            var cache = new MemoryCache(new MemoryCacheOptions());
            return new OrderService(ctx, new CouponService(ctx, _clock), new StoreSettingsService(ctx, cache, _clock),
                _emails, _clock, NullLogger<OrderService>.Instance);
        }

        private PlaceOrderRequest Request(params CartLine[] items) => new()
        {
            Items = items.ToList(),
            FullName = "Nguyễn Văn A",
            Phone = "0901234567",
            Street = "1 Lê Lợi",
            Province = "Hồ Chí Minh",
            PaymentMethod = (int)EnumCommons.PaymentMethod.Cod,
        };

        [Fact]
        public async Task Places_order_with_database_prices_and_reserves_stock()
        {
            using var ctx = _db.NewContext();
            var placed = await NewService(ctx).PlaceOrderAsync(
                Request(new CartLine(_ids[0], 2), new CartLine(_ids[1], 1)), new OrderCustomer(null, null), "vi");

            using var check = _db.NewContext();
            var order = await check.Orders.Include(o => o.Details).SingleAsync(o => o.Id == placed.Id);
            Assert.Equal(2 * 76_000 + 89_000, order.SubTotal);
            Assert.Equal(30_000, order.ShippingFee);
            Assert.Equal(order.SubTotal + 30_000, order.TotalAmount);
            Assert.True(order.StockReserved);
            Assert.Contains(order.Details, d => d.ProductId == _ids[0] && d.UnitPrice == 76_000 && d.LineTotal == 152_000 && d.ProductName == "Nigiri octopus");

            var p0 = await check.Products.SingleAsync(p => p.Id == _ids[0]);
            Assert.Equal(8, p0.Quantity);
            Assert.Equal(2, p0.SoldCount);
            Assert.Single(await check.OrderStatusHistory.Where(h => h.OrderId == order.Id).ToListAsync());
            Assert.Empty(_emails.Sent); // guest without email: nothing to send
        }

        [Fact]
        public async Task Rejects_more_than_available_and_leaves_stock_untouched()
        {
            using var ctx = _db.NewContext();
            var ex = await Assert.ThrowsAsync<AppException>(() =>
                NewService(ctx).PlaceOrderAsync(Request(new CartLine(_ids[1], 4)), new OrderCustomer(null, null), "vi"));
            Assert.Equal("insufficient_stock", ex.Code);

            using var check = _db.NewContext();
            Assert.Equal(3, (await check.Products.SingleAsync(p => p.Id == _ids[1])).Quantity);
            Assert.Empty(await check.Orders.ToListAsync());
        }

        [Fact]
        public async Task Last_item_can_only_be_sold_once()
        {
            using (var ctx = _db.NewContext())
                await NewService(ctx).PlaceOrderAsync(Request(new CartLine(_ids[1], 3)), new OrderCustomer(null, null), "vi");

            using var ctx2 = _db.NewContext();
            var ex = await Assert.ThrowsAsync<AppException>(() =>
                NewService(ctx2).PlaceOrderAsync(Request(new CartLine(_ids[1], 1)), new OrderCustomer(null, null), "vi"));
            Assert.Equal("product_unavailable", ex.Code);
        }

        [Fact]
        public async Task Applies_coupon_and_releases_it_when_cancelled()
        {
            using (var seed = _db.NewContext())
            {
                seed.Coupons.Add(new CouponEntities
                {
                    Code = "WELCOME10", Type = (int)DiscountTypeEnum.Percentage, Value = 10, MaxDiscountAmount = 50_000,
                    UsageLimit = 1, IsActive = true, CreatedAt = TestClock.Now,
                });
                seed.SaveChanges();
            }

            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            var request = Request(new CartLine(_ids[0], 2), new CartLine(_ids[1], 1));
            request.CouponCode = "welcome10";
            var placed = await service.PlaceOrderAsync(request, new OrderCustomer(null, null), "vi");
            Assert.Equal(241_000 - 24_100 + 30_000, placed.Total);

            // Usage limit reached
            var again = Request(new CartLine(_ids[0], 1));
            again.CouponCode = "WELCOME10";
            Assert.Equal("coupon_used_up", (await Assert.ThrowsAsync<AppException>(() =>
                service.PlaceOrderAsync(again, new OrderCustomer(null, null), "vi"))).Code);

            await service.UpdateStatusAsync(placed.Id, (int)Status.Cancelled, "test", "admin");

            using var check = _db.NewContext();
            Assert.Equal(0, (await check.Coupons.SingleAsync()).UsedCount);
            Assert.Equal(10, (await check.Products.SingleAsync(p => p.Id == _ids[0])).Quantity);
            Assert.Equal(0, (await check.Products.SingleAsync(p => p.Id == _ids[0])).SoldCount);
        }

        [Fact]
        public async Task Enforces_status_transitions()
        {
            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            var placed = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(null, null), "vi");

            var ex = await Assert.ThrowsAsync<AppException>(() => service.UpdateStatusAsync(placed.Id, (int)Status.Delivered, null, "admin"));
            Assert.Equal("invalid_status_transition", ex.Code);

            await service.UpdateStatusAsync(placed.Id, (int)Status.Confirmed, null, "admin");
            await service.UpdateStatusAsync(placed.Id, (int)Status.Shipping, null, "admin");
            var delivered = await service.UpdateStatusAsync(placed.Id, (int)Status.Delivered, null, "admin");

            Assert.Equal((int)EnumCommons.PaymentStatus.Paid, delivered.PaymentStatus); // COD collected on delivery
            Assert.Equal(4, delivered.History.Count);
            Assert.Equal([(int)Status.Refunded], delivered.AllowedNextStatuses);
        }

        [Fact]
        public async Task Customers_only_see_their_own_orders()
        {
            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            var mine = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(7, "a@example.com"), "vi");

            Assert.NotNull(await service.GetMyOrderAsync(7, mine.Code));
            Assert.Null(await service.GetMyOrderAsync(8, mine.Code));
            Assert.Equal(1, (await service.GetMyOrdersAsync(7, 1, 10)).TotalItems);
            Assert.Equal(0, (await service.GetMyOrdersAsync(8, 1, 10)).TotalItems);
            Assert.Single(_emails.Sent); // confirmation for the signed-in customer
        }

        [Fact]
        public async Task Guest_tracking_requires_matching_phone()
        {
            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            var placed = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(null, null), "vi");

            Assert.Null(await service.TrackAsync(placed.Code, "0999999999"));
            Assert.NotNull(await service.TrackAsync(placed.Code, "+84 901 234 567"));
        }

        [Fact]
        public async Task Customer_can_cancel_only_pending_orders()
        {
            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            var a = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(7, "a@example.com"), "vi");
            var b = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(7, "a@example.com"), "vi");
            await service.UpdateStatusAsync(b.Id, (int)Status.Confirmed, null, "admin");

            await service.CancelMyOrderAsync(7, a.Code);
            Assert.Equal("order_not_cancellable",
                (await Assert.ThrowsAsync<AppException>(() => service.CancelMyOrderAsync(7, b.Code))).Code);
            Assert.Equal("order_not_found",
                (await Assert.ThrowsAsync<AppException>(() => service.CancelMyOrderAsync(8, b.Code))).Code);
        }

        [Fact]
        public async Task Quote_flags_stock_problems_without_throwing()
        {
            using var ctx = _db.NewContext();
            var quote = await NewService(ctx).QuoteAsync(new CartQuoteRequest
            {
                Items = [new(_ids[0], 1), new(_ids[1], 5), new(999, 1)],
                CouponCode = "NOPE",
            }, "vi");

            Assert.False(quote.CanCheckout);
            Assert.Equal("insufficient_stock", quote.Lines.Single(l => l.ProductId == _ids[1]).Problem);
            Assert.Equal("unavailable", quote.Lines.Single(l => l.ProductId == 999).Problem);
            Assert.Equal("coupon_invalid", quote.CouponError);
            Assert.Equal(76_000, quote.Subtotal); // only valid lines are priced
        }

        [Fact]
        public async Task Admin_counts_orders_per_status()
        {
            using var ctx = _db.NewContext();
            var service = NewService(ctx);
            await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(null, null), "vi");
            var second = await service.PlaceOrderAsync(Request(new CartLine(_ids[0], 1)), new OrderCustomer(null, null), "vi");
            await service.UpdateStatusAsync(second.Id, (int)Status.Cancelled, null, "admin");

            var counts = await NewService(_db.NewContext()).AdminCountsAsync();

            Assert.Equal(1, counts[(int)Status.Pending]);
            Assert.Equal(1, counts[(int)Status.Cancelled]);
            Assert.False(counts.ContainsKey((int)Status.Delivered));
        }
    }
}
