using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Order;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Email;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Status = JapaneseFood.Common.Enums.EnumCommons.OrderStatus;

namespace JapaneseFood.Service.Orders
{
    public interface IOrderService
    {
        /// <summary>Prices a cart from current DB prices/stock. Never throws for coupon problems (see <see cref="CartQuote.CouponError"/>).</summary>
        Task<CartQuote> QuoteAsync(CartQuoteRequest request, string lang, CancellationToken ct = default);
        Task<PlacedOrder> PlaceOrderAsync(PlaceOrderRequest request, OrderCustomer customer, string lang, CancellationToken ct = default);

        Task<PagedResult<OrderSummary>> GetMyOrdersAsync(long userId, int page, int pageSize, CancellationToken ct = default);
        /// <summary>Null when the order does not exist or belongs to someone else.</summary>
        Task<OrderView?> GetMyOrderAsync(long userId, string code, CancellationToken ct = default);
        /// <summary>Guest tracking: the phone number must match the order.</summary>
        Task<OrderView?> TrackAsync(string code, string phone, CancellationToken ct = default);
        Task CancelMyOrderAsync(long userId, string code, CancellationToken ct = default);

        Task<PagedResult<OrderSummary>> AdminListAsync(AdminOrderQuery query, CancellationToken ct = default);
        /// <summary>Orders per status (all time) for the admin tabs.</summary>
        Task<IReadOnlyDictionary<int, int>> AdminCountsAsync(CancellationToken ct = default);
        Task<OrderView?> AdminGetAsync(long id, CancellationToken ct = default);
        Task<OrderView> UpdateStatusAsync(long id, int toStatus, string? note, string changedBy, CancellationToken ct = default);
    }

    public partial class OrderService(
        DataContext db,
        ICouponService coupons,
        IStoreSettingsService settings,
        IEmailQueue emails,
        TimeProvider clock,
        ILogger<OrderService> logger) : IOrderService
    {
        public const int MaxLines = 50;
        public const int MaxQuantityPerLine = 99;

        /// <summary>Which statuses an order may move to. Anything else is rejected.</summary>
        public static readonly IReadOnlyDictionary<Status, Status[]> Transitions = new Dictionary<Status, Status[]>
        {
            [Status.Pending] = [Status.Confirmed, Status.Cancelled],
            [Status.Confirmed] = [Status.Preparing, Status.Shipping, Status.Cancelled],
            [Status.Preparing] = [Status.Shipping, Status.Cancelled],
            [Status.Shipping] = [Status.Delivered],
            [Status.Delivered] = [Status.Refunded],
            [Status.Cancelled] = [],
            [Status.Refunded] = [],
        };

        // ---------------------------------------------------------------- cart / checkout

        public async Task<CartQuote> QuoteAsync(CartQuoteRequest request, string lang, CancellationToken ct = default)
        {
            var lines = MergeLines(request.Items);
            var products = await LoadProductsAsync(lines.Select(l => l.ProductId).ToList(), lang, ct);

            var quoteLines = new List<QuoteLine>();
            foreach (var line in lines)
            {
                if (!products.TryGetValue(line.ProductId, out var p))
                {
                    quoteLines.Add(new QuoteLine(line.ProductId, "", line.ProductId.ToString(), null, 0, 0, line.Quantity, 0, 0, "unavailable"));
                    continue;
                }

                string? problem = !p.InStock ? "out_of_stock" : line.Quantity > p.Stock ? "insufficient_stock" : null;
                quoteLines.Add(new QuoteLine(p.Id, p.Name, p.Slug, p.ImageUrl, p.Price, p.EffectivePrice, line.Quantity,
                    p.Stock, p.EffectivePrice * line.Quantity, problem));
            }

            var subtotal = quoteLines.Where(l => l.Problem == null).Sum(l => l.LineTotal);

            decimal discount = 0;
            string? couponCode = null, couponError = null;
            if (!string.IsNullOrWhiteSpace(request.CouponCode) && subtotal > 0)
            {
                try
                {
                    var applied = await coupons.ApplyAsync(request.CouponCode, subtotal, ct);
                    discount = applied.DiscountAmount;
                    couponCode = applied.Code;
                }
                catch (AppException ex)
                {
                    couponError = ex.Code;
                }
            }

            var shipping = await settings.GetShippingAsync(ct);
            var totals = CalculateTotals(subtotal, discount, shipping);

            return new CartQuote(
                quoteLines,
                quoteLines.Where(l => l.Problem == null).Sum(l => l.Quantity),
                subtotal,
                discount,
                totals.ShippingFee,
                totals.Total,
                shipping.FreeThreshold,
                Math.Max(0, shipping.FreeThreshold - (subtotal - discount)),
                couponCode,
                couponError,
                quoteLines.Count > 0 && quoteLines.All(l => l.Problem == null));
        }

        public async Task<PlacedOrder> PlaceOrderAsync(PlaceOrderRequest request, OrderCustomer customer, string lang, CancellationToken ct = default)
        {
            lang = Languages.Normalize(lang);
            var email = customer.UserId.HasValue ? customer.Email : request.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email)) email = null;
            ValidateCheckout(request, email);

            if (request.PaymentMethod != (int)EnumCommons.PaymentMethod.Cod)
                throw AppException.BadRequest("payment_method_unavailable", "Only cash on delivery is available right now.");

            var lines = MergeLines(request.Items);
            var products = await LoadProductsAsync(lines.Select(l => l.ProductId).ToList(), Languages.Default, ct);

            foreach (var line in lines)
            {
                if (!products.TryGetValue(line.ProductId, out var p) || !p.InStock)
                    throw AppException.Conflict("product_unavailable", "A product in the cart is no longer available.",
                        new Dictionary<string, object?> { ["productId"] = line.ProductId });
                if (line.Quantity > p.Stock)
                    throw AppException.Conflict("insufficient_stock", "Not enough stock for a product in the cart.",
                        new Dictionary<string, object?> { ["productId"] = line.ProductId, ["available"] = p.Stock });
            }

            var details = lines.Select(l =>
            {
                var p = products[l.ProductId];
                return new OrderDetailEntities
                {
                    ProductId = p.Id,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    UnitPrice = p.EffectivePrice,
                    LineTotal = p.EffectivePrice * l.Quantity,
                };
            }).ToList();

            var subtotal = details.Sum(d => d.LineTotal);
            AppliedCoupon? coupon = string.IsNullOrWhiteSpace(request.CouponCode)
                ? null
                : await coupons.ApplyAsync(request.CouponCode, subtotal, ct);
            var shipping = await settings.GetShippingAsync(ct);
            var totals = CalculateTotals(subtotal, coupon?.DiscountAmount ?? 0, shipping);
            var now = clock.GetLocalNow().DateTime;

            var order = new OrderEntities
            {
                Code = NewOrderCode(now),
                UserId = customer.UserId ?? 0,
                UserName = email,
                FullName = request.FullName.Trim(),
                Phone = NormalizePhone(request.Phone),
                Province = request.Province?.Trim(),
                District = request.District?.Trim(),
                Ward = request.Ward?.Trim(),
                Address = FormatAddress(request.Street, request.Ward, request.District, request.Province),
                Note = request.Note?.Trim(),
                Quantity = details.Sum(d => d.Quantity),
                SubTotal = subtotal,
                Discount = totals.Discount,
                ShippingFee = totals.ShippingFee,
                TotalAmount = totals.Total,
                CouponCode = coupon?.Code,
                Status = (int)Status.Pending,
                PaymentMethod = request.PaymentMethod,
                PaymentStatus = (int)EnumCommons.PaymentStatus.Unpaid,
                Language = lang,
                StockReserved = true,
                IsActive = true,
                CreatedAt = now,
                CreatedBy = email ?? request.Phone,
                UpdatedAt = now,
                Details = details,
            };

            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(ct);

                // Atomic conditional decrement: two shoppers can never both buy the last item
                foreach (var d in details)
                {
                    var affected = await db.Products
                        .Where(p => p.Id == d.ProductId && p.Quantity >= d.Quantity && !p.IsDelete && p.IsActive && p.IsAvailable)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(p => p.Quantity, p => p.Quantity - d.Quantity)
                            .SetProperty(p => p.SoldCount, p => p.SoldCount + d.Quantity), ct);

                    if (affected == 0)
                        throw AppException.Conflict("insufficient_stock", "Not enough stock for a product in the cart.",
                            new Dictionary<string, object?> { ["productId"] = d.ProductId });
                }

                if (coupon != null)
                {
                    var redeemed = await db.Coupons
                        .Where(c => c.Id == coupon.Id && (c.UsageLimit == null || c.UsedCount < c.UsageLimit))
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1), ct);
                    if (redeemed == 0)
                        throw AppException.BadRequest("coupon_used_up", "Coupon has been fully redeemed.");
                }

                db.Orders.Add(order);
                await db.SaveChangesAsync(ct);

                db.OrderStatusHistory.Add(new OrderStatusHistoryEntities
                {
                    OrderId = order.Id,
                    FromStatus = (int)Status.Pending,
                    ToStatus = (int)Status.Pending,
                    Note = "Order placed",
                    ChangedBy = order.CreatedBy,
                    ChangedAt = now,
                });
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            });

            logger.LogInformation("Order {Code} placed: {Total} VND, {Lines} lines, user {UserId}",
                order.Code, order.TotalAmount, details.Count, customer.UserId);

            if (!string.IsNullOrWhiteSpace(email))
            {
                var view = await LoadViewAsync(db.Orders.Where(o => o.Id == order.Id), ct);
                var store = await settings.GetStoreInfoAsync(ct);
                if (view != null) emails.Enqueue(EmailTemplates.OrderPlaced(email, view, store, lang));
            }

            return new PlacedOrder(order.Id, order.Code, order.TotalAmount, order.PaymentMethod);
        }

        // ---------------------------------------------------------------- customer

        public async Task<PagedResult<OrderSummary>> GetMyOrdersAsync(long userId, int page, int pageSize, CancellationToken ct = default)
        {
            var (p, size) = Paging.Normalize(page, pageSize, 10, 50);
            var query = db.Orders.AsNoTracking().Where(o => o.UserId == userId && !o.IsDelete);
            var total = await query.CountAsync(ct);
            var items = await LoadSummariesAsync(query.OrderByDescending(o => o.CreatedAt).Skip((p - 1) * size).Take(size), ct);
            return new PagedResult<OrderSummary>(items, p, size, total);
        }

        public Task<OrderView?> GetMyOrderAsync(long userId, string code, CancellationToken ct = default)
            => LoadViewAsync(db.Orders.Where(o => o.Code == code && o.UserId == userId && !o.IsDelete), ct);

        public async Task<OrderView?> TrackAsync(string code, string phone, CancellationToken ct = default)
        {
            var normalized = NormalizePhone(phone);
            if (string.IsNullOrEmpty(normalized)) return null;
            var view = await LoadViewAsync(db.Orders.Where(o => o.Code == code.Trim() && !o.IsDelete), ct);
            return view != null && NormalizePhone(view.Phone ?? "") == normalized ? view : null;
        }

        public async Task CancelMyOrderAsync(long userId, string code, CancellationToken ct = default)
        {
            var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Code == code && o.UserId == userId && !o.IsDelete, ct)
                ?? throw AppException.NotFound("order_not_found", "Order not found.");
            if (order.Status != (int)Status.Pending)
                throw AppException.Conflict("order_not_cancellable", "Only pending orders can be cancelled.");

            await UpdateStatusAsync(order.Id, (int)Status.Cancelled, "Cancelled by customer", order.UserName ?? $"user:{userId}", ct);
        }

        // ---------------------------------------------------------------- admin

        public async Task<PagedResult<OrderSummary>> AdminListAsync(AdminOrderQuery q, CancellationToken ct = default)
        {
            var (page, size) = Paging.Normalize(q.Page, q.PageSize, 20, 100);
            var query = db.Orders.AsNoTracking().Where(o => !o.IsDelete);

            if (q.Status.HasValue) query = query.Where(o => o.Status == q.Status.Value);
            if (q.From.HasValue) query = query.Where(o => o.CreatedAt >= q.From.Value);
            if (q.To.HasValue) query = query.Where(o => o.CreatedAt < q.To.Value.Date.AddDays(1));
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var term = q.Search.Trim();
                query = query.Where(o => o.Code.Contains(term)
                    || (o.FullName != null && o.FullName.Contains(term))
                    || (o.Phone != null && o.Phone.Contains(term))
                    || (o.UserName != null && o.UserName.Contains(term)));
            }

            var total = await query.CountAsync(ct);
            var items = await LoadSummariesAsync(query.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * size).Take(size), ct);
            return new PagedResult<OrderSummary>(items, page, size, total);
        }

        public async Task<IReadOnlyDictionary<int, int>> AdminCountsAsync(CancellationToken ct = default)
            => await db.Orders.AsNoTracking().Where(o => !o.IsDelete)
                .GroupBy(o => o.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count, ct);

        public Task<OrderView?> AdminGetAsync(long id, CancellationToken ct = default)
            => LoadViewAsync(db.Orders.Where(o => o.Id == id && !o.IsDelete), ct);

        public async Task<OrderView> UpdateStatusAsync(long id, int toStatus, string? note, string changedBy, CancellationToken ct = default)
        {
            if (!Enum.IsDefined(typeof(Status), toStatus))
                throw AppException.BadRequest("invalid_status", "Unknown order status.");

            var strategy = db.Database.CreateExecutionStrategy();
            var (code, email, fullName, phone, language) = await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(ct);

                var order = await db.Orders.Include(o => o.Details).FirstOrDefaultAsync(o => o.Id == id && !o.IsDelete, ct)
                    ?? throw AppException.NotFound("order_not_found", "Order not found.");

                var from = (Status)order.Status;
                var to = (Status)toStatus;
                if (!Transitions.TryGetValue(from, out var allowed) || !allowed.Contains(to))
                    throw AppException.Conflict("invalid_status_transition", $"Cannot move an order from {from} to {to}.",
                        new Dictionary<string, object?> { ["from"] = (int)from, ["to"] = (int)to });

                var now = clock.GetLocalNow().DateTime;

                if (to == Status.Cancelled && order.StockReserved)
                {
                    foreach (var d in order.Details)
                    {
                        await db.Products.Where(p => p.Id == d.ProductId)
                            .ExecuteUpdateAsync(s => s
                                .SetProperty(p => p.Quantity, p => p.Quantity + d.Quantity)
                                .SetProperty(p => p.SoldCount, p => p.SoldCount >= d.Quantity ? p.SoldCount - d.Quantity : 0), ct);
                    }
                    order.StockReserved = false;

                    // Give the coupon redemption back so the customer can use it again
                    if (!string.IsNullOrEmpty(order.CouponCode))
                    {
                        await db.Coupons.Where(c => c.Code == order.CouponCode && c.UsedCount > 0)
                            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount - 1), ct);
                    }
                }

                if (to == Status.Delivered && order.PaymentMethod == (int)EnumCommons.PaymentMethod.Cod)
                {
                    order.PaymentStatus = (int)EnumCommons.PaymentStatus.Paid;
                    order.PaidAt ??= now;
                }
                if (to == Status.Refunded)
                    order.PaymentStatus = (int)EnumCommons.PaymentStatus.Refunded;

                order.Status = (int)to;
                order.UpdatedAt = now;
                order.UpdatedBy = changedBy;

                db.OrderStatusHistory.Add(new OrderStatusHistoryEntities
                {
                    OrderId = order.Id,
                    FromStatus = (int)from,
                    ToStatus = (int)to,
                    Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                    ChangedBy = changedBy,
                    ChangedAt = now,
                });

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return (order.Code, order.UserName, order.FullName, order.Phone, order.Language);
            });

            if (!string.IsNullOrWhiteSpace(email))
            {
                var store = await settings.GetStoreInfoAsync(ct);
                // In the language the customer ordered in
                emails.Enqueue(EmailTemplates.OrderStatusChanged(email, code, fullName, phone, toStatus, note, store, language ?? Languages.Default));
            }

            return (await AdminGetAsync(id, ct))!;
        }

        // ---------------------------------------------------------------- helpers

        internal sealed record Totals(decimal Discount, decimal ShippingFee, decimal Total);

        /// <summary>Free shipping once the discounted subtotal reaches the threshold (threshold 0 = never free).</summary>
        internal static Totals CalculateTotals(decimal subtotal, decimal discount, ShippingSettings shipping)
        {
            discount = Math.Clamp(discount, 0, subtotal);
            var afterDiscount = subtotal - discount;
            var fee = subtotal <= 0 || (shipping.FreeThreshold > 0 && afterDiscount >= shipping.FreeThreshold) ? 0 : shipping.Fee;
            return new Totals(discount, fee, afterDiscount + fee);
        }

        internal static List<CartLine> MergeLines(IEnumerable<CartLine>? items)
        {
            var merged = (items ?? [])
                .Where(i => i.ProductId > 0 && i.Quantity > 0)
                .GroupBy(i => i.ProductId)
                .Select(g => new CartLine(g.Key, Math.Min(MaxQuantityPerLine, g.Sum(x => x.Quantity))))
                .ToList();

            if (merged.Count > MaxLines)
                throw AppException.BadRequest("cart_too_large", $"A cart can hold at most {MaxLines} different products.");
            return merged;
        }

        private async Task<Dictionary<long, ProductCard>> LoadProductsAsync(List<long> ids, string lang, CancellationToken ct)
        {
            if (ids.Count == 0) return [];
            var rows = await ProductService.ProjectRows(db, ProductService.ActiveProducts(db).Where(p => ids.Contains(p.Id)), Languages.Normalize(lang))
                .ToListAsync(ct);
            return rows.Select(ProductService.ToCard).ToDictionary(c => c.Id);
        }

        /// <summary>Phone is the key contact in VN (delivery + guest order tracking); email is optional for guests.</summary>
        private static void ValidateCheckout(PlaceOrderRequest r, string? email)
        {
            var errors = new Dictionary<string, object?>();
            if (string.IsNullOrWhiteSpace(r.FullName) || r.FullName.Trim().Length > 100) errors["fullName"] = "required";
            if (string.IsNullOrEmpty(NormalizePhone(r.Phone))) errors["phone"] = "invalid_phone";
            if (string.IsNullOrWhiteSpace(r.Street) || r.Street.Trim().Length > 250) errors["street"] = "required";
            if (r.Note?.Length > 500) errors["note"] = "too_long";
            if (email != null && !System.Net.Mail.MailAddress.TryCreate(email, out _))
                errors["email"] = "invalid_email";
            if (r.Items == null || r.Items.Count == 0) errors["items"] = "empty_cart";

            if (errors.Count > 0)
                throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);
        }

        /// <summary>"0901 234 567" / "+84 901234567" → "0901234567"; "" when not a Vietnamese mobile/landline number.</summary>
        internal static string NormalizePhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
            var digits = NonDigits().Replace(phone, "");
            if (phone.TrimStart().StartsWith('+') && digits.StartsWith("84")) digits = "0" + digits[2..];
            else if (digits.StartsWith("84") && digits.Length == 11) digits = "0" + digits[2..];
            return digits.Length == 10 && digits[0] == '0' ? digits : string.Empty;
        }

        private static string FormatAddress(params string?[] parts)
            => string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));

        private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        private static string NewOrderCode(DateTime now)
        {
            Span<char> suffix = stackalloc char[5];
            for (var i = 0; i < suffix.Length; i++) suffix[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
            return $"JF{now:yyMMdd}{suffix}";
        }

        private async Task<List<OrderSummary>> LoadSummariesAsync(IQueryable<OrderEntities> query, CancellationToken ct)
        {
            var rows = await query.Select(o => new
            {
                o.Id, o.Code, o.Status, o.PaymentMethod, o.PaymentStatus, o.FullName, o.Phone,
                o.TotalAmount, o.Quantity, o.CreatedAt,
                FirstProductName = o.Details.OrderBy(d => d.Id).Select(d => d.ProductName).FirstOrDefault(),
                FirstImage = o.Details.OrderBy(d => d.Id)
                    .Select(d => db.Images.Where(i => i.ProductId == d.ProductId)
                        .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                        .Select(i => i.ImageUrl)
                        .FirstOrDefault())
                    .FirstOrDefault(),
            }).ToListAsync(ct);

            return rows.Select(o => new OrderSummary(o.Id, o.Code, o.Status, o.PaymentMethod, o.PaymentStatus,
                o.FullName, o.Phone, o.TotalAmount, o.Quantity, o.CreatedAt, o.FirstProductName,
                ImageUrls.ToPublic(o.FirstImage))).ToList();
        }

        private async Task<OrderView?> LoadViewAsync(IQueryable<OrderEntities> query, CancellationToken ct)
        {
            var o = await query.AsNoTracking().Include(x => x.Details).FirstOrDefaultAsync(ct);
            if (o == null) return null;

            var productIds = o.Details.Select(d => d.ProductId).Distinct().ToList();
            var products = await db.Products.AsNoTracking()
                .Where(p => productIds.Contains(p.Id))
                .Select(p => new
                {
                    p.Id,
                    p.Slug,
                    p.Name,
                    Image = p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault(),
                })
                .ToDictionaryAsync(p => p.Id, ct);

            var history = await db.OrderStatusHistory.AsNoTracking()
                .Where(h => h.OrderId == o.Id)
                .OrderBy(h => h.ChangedAt).ThenBy(h => h.Id)
                .Select(h => new OrderStatusEvent(h.FromStatus, h.ToStatus, h.ChangedAt, h.Note))
                .ToListAsync(ct);

            var lines = o.Details.OrderBy(d => d.Id).Select(d =>
            {
                products.TryGetValue(d.ProductId, out var p);
                return new OrderLineView(d.ProductId, d.ProductName ?? p?.Name ?? $"#{d.ProductId}",
                    p == null ? null : string.IsNullOrEmpty(p.Slug) ? p.Id.ToString() : p.Slug,
                    ImageUrls.ToPublic(p?.Image), d.UnitPrice, d.Quantity, d.LineTotal);
            }).ToList();

            var allowed = Transitions.TryGetValue((Status)o.Status, out var next) ? next.Select(s => (int)s).ToList() : [];

            return new OrderView(o.Id, o.Code, o.Status, o.PaymentMethod, o.PaymentStatus, o.UserId, o.FullName, o.Phone,
                o.UserName, o.Address, o.Province, o.District, o.Ward, o.Note, o.Quantity, o.SubTotal, o.Discount,
                o.ShippingFee, o.TotalAmount, o.CouponCode, o.CreatedAt, o.PaidAt, lines, history, allowed);
        }

        [GeneratedRegex(@"\D")]
        private static partial Regex NonDigits();
    }
}
