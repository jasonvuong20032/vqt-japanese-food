using JapaneseFood.Common.Enums;
using JapaneseFood.Model;
using JapaneseFood.Model.Order;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Orders;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace vqt_japanese_food_web.Controllers
{
    public class CartController : Controller
    {
        private readonly ILogger<CartController> _logger;
        private readonly IOrderService _orders;

        public CartController(ILogger<CartController> logger, IOrderService orders)
        {
            _logger = logger;
            _orders = orders;
        }

        public IActionResult Index()
        {
            return View();
        }

        public ActionResult CheckOut()
        {
            var model = new OrderDto();
            var userJson = HttpContext.Session.GetString("user_customer");
            if (!string.IsNullOrEmpty(userJson))
            {
                var user = JsonConvert.DeserializeObject<UserSessionDto>(userJson);
                if (user != null)
                {
                    model.UserId = user.Id;
                    model.FullName = user.FullName;
                    model.UserName = user.UserName;
                    model.Phone = user.Phone;
                    model.Address = user.Address;
                }
            }

            return View(model);
        }

        /// <summary>
        /// Legacy checkout, now backed by the shared OrderService: prices come from the database (the posted
        /// Price is ignored), stock is reserved atomically and the confirmation email is queued.
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> CheckOut(OrderDto model)
        {
            // Identity comes from the session, never from the posted UserId
            UserSessionDto? sessionUser = null;
            var userJson = HttpContext.Session.GetString("user_customer");
            if (!string.IsNullOrEmpty(userJson)) sessionUser = JsonConvert.DeserializeObject<UserSessionDto>(userJson);

            var request = new PlaceOrderRequest
            {
                Items = model.OrderDetails?.Select(d => new CartLine(d.ProductId, d.Quantity)).ToList() ?? [],
                FullName = model.FullName ?? string.Empty,
                Phone = model.Phone ?? string.Empty,
                Email = sessionUser?.UserName ?? model.UserName,
                Street = model.Address ?? string.Empty,
                Note = model.Note,
                PaymentMethod = (int)EnumCommons.PaymentMethod.Cod,
            };

            try
            {
                var placed = await _orders.PlaceOrderAsync(request, new OrderCustomer(sessionUser?.Id, sessionUser?.UserName), Languages.Default);
                return Json(new { success = true, message = "Order placed successfully!", code = placed.Code });
            }
            catch (AppException ex)
            {
                _logger.LogInformation("Legacy checkout rejected: {Code}", ex.Code);
                return Json(new { success = false, error = ex.Message });
            }
        }
    }
}