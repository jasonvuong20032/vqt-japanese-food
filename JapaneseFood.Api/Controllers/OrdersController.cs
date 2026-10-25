using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Route("api")]
    public class OrdersController(IOrderService orders) : ControllerBase
    {
        /// <summary>Re-prices the cart from the database. The browser cart only stores product ids and quantities.</summary>
        [HttpPost("cart/quote")]
        public Task<CartQuote> Quote(CartQuoteRequest request, CancellationToken ct)
            => orders.QuoteAsync(request, HttpContext.GetLanguage(), ct);

        /// <summary>Guests can check out too; signed-in customers get the order linked to their account.</summary>
        [HttpPost("orders")]
        [EnableRateLimiting("checkout")]
        public async Task<ActionResult<PlacedOrder>> Place(PlaceOrderRequest request, CancellationToken ct)
        {
            var customer = new OrderCustomer(User.GetUserId(), User.GetEmail());
            var placed = await orders.PlaceOrderAsync(request, customer, HttpContext.GetLanguage(), ct);
            return Created($"/api/orders/{placed.Code}", placed);
        }

        [Authorize]
        [HttpGet("orders")]
        public Task<PagedResult<OrderSummary>> Mine(int page = 1, int pageSize = 10, CancellationToken ct = default)
            => orders.GetMyOrdersAsync(User.RequireUserId(), page, pageSize, ct);

        [Authorize]
        [HttpGet("orders/{code}")]
        public async Task<ActionResult<OrderView>> Get(string code, CancellationToken ct)
        {
            var order = await orders.GetMyOrderAsync(User.RequireUserId(), code, ct);
            return order == null ? NotFound() : order;
        }

        [Authorize]
        [HttpPost("orders/{code}/cancel")]
        public async Task<IActionResult> Cancel(string code, CancellationToken ct)
        {
            await orders.CancelMyOrderAsync(User.RequireUserId(), code, ct);
            return NoContent();
        }

        public sealed record TrackRequest(string Code, string Phone);

        [HttpPost("orders/track")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<OrderView>> Track(TrackRequest request, CancellationToken ct)
        {
            var order = await orders.TrackAsync(request.Code, request.Phone, ct);
            return order == null ? NotFound() : order;
        }
    }
}
