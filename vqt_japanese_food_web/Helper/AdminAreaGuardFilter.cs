using JapaneseFood.Model;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Newtonsoft.Json;
using static JapaneseFood.Common.Enums.EnumCommons;

namespace vqt_japanese_food_web.Helper
{
    /// <summary>
    /// Every page in the Admin area except the sign-in page requires an Admin/Staff session.
    /// Before this filter the admin pages were reachable by anyone who knew the URL.
    /// </summary>
    public class AdminAreaGuardFilter : IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var routeValues = context.RouteData.Values;
            var area = routeValues["area"]?.ToString();
            if (!string.Equals(area, "Admin", StringComparison.OrdinalIgnoreCase)) return;
            if (string.Equals(routeValues["controller"]?.ToString(), "SignInMng", StringComparison.OrdinalIgnoreCase)) return;

            var json = context.HttpContext.Session.GetString("user_info");
            var user = string.IsNullOrEmpty(json) ? null : JsonConvert.DeserializeObject<UserSessionDto>(json);
            if (user != null && (user.RoleId == (int)ERoleType.Admin || user.RoleId == (int)ERoleType.Staff)) return;

            context.Result = new RedirectToActionResult("Index", "SignInMng", new { area = "Admin" });
        }
    }
}
