namespace JapaneseFood.Service.Orders
{
    public sealed record CartLine(long ProductId, int Quantity);

    public sealed class CartQuoteRequest
    {
        public List<CartLine> Items { get; set; } = [];
        public string? CouponCode { get; set; }
    }

    /// <param name="Problem">null when fine; otherwise "unavailable" | "out_of_stock" | "insufficient_stock".</param>
    public sealed record QuoteLine(
        long ProductId,
        string Name,
        string Slug,
        string? ImageUrl,
        decimal Price,
        decimal UnitPrice,
        int Quantity,
        int AvailableStock,
        decimal LineTotal,
        string? Problem);

    public sealed record CartQuote(
        IReadOnlyList<QuoteLine> Lines,
        int TotalQuantity,
        decimal Subtotal,
        decimal Discount,
        decimal ShippingFee,
        decimal Total,
        decimal FreeShippingThreshold,
        decimal AmountToFreeShipping,
        string? CouponCode,
        string? CouponError,
        bool CanCheckout);

    public sealed class PlaceOrderRequest
    {
        public List<CartLine> Items { get; set; } = [];
        public string FullName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        /// <summary>Optional for guests (confirmation is emailed when given); signed-in users use their account email.</summary>
        public string? Email { get; set; }
        public string? Province { get; set; }
        public string? District { get; set; }
        public string? Ward { get; set; }
        public string Street { get; set; } = string.Empty;
        public string? Note { get; set; }
        public string? CouponCode { get; set; }
        public int PaymentMethod { get; set; }
    }

    public sealed record OrderCustomer(long? UserId, string? Email);

    public sealed record PlacedOrder(long Id, string Code, decimal Total, int PaymentMethod);

    public sealed record OrderLineView(long ProductId, string ProductName, string? Slug, string? ImageUrl,
        decimal UnitPrice, int Quantity, decimal LineTotal);

    public sealed record OrderStatusEvent(int FromStatus, int ToStatus, DateTime At, string? Note);

    public sealed record OrderView(
        long Id,
        string Code,
        int Status,
        int PaymentMethod,
        int PaymentStatus,
        long UserId,
        string? FullName,
        string? Phone,
        string? Email,
        string? Address,
        string? Province,
        string? District,
        string? Ward,
        string? Note,
        int Quantity,
        decimal Subtotal,
        decimal Discount,
        decimal ShippingFee,
        decimal Total,
        string? CouponCode,
        DateTime CreatedAt,
        DateTime? PaidAt,
        IReadOnlyList<OrderLineView> Lines,
        IReadOnlyList<OrderStatusEvent> History,
        IReadOnlyList<int> AllowedNextStatuses);

    public sealed record OrderSummary(
        long Id,
        string Code,
        int Status,
        int PaymentMethod,
        int PaymentStatus,
        string? FullName,
        string? Phone,
        decimal Total,
        int Quantity,
        DateTime CreatedAt,
        string? FirstProductName,
        string? FirstImageUrl);

    public sealed class AdminOrderQuery
    {
        public int? Status { get; set; }
        public string? Search { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
