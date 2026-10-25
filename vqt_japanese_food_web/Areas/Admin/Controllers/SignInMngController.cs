using JapaneseFood.Entity;
using JapaneseFood.Model;
using JapaneseFood.Model.User;
using JapaneseFood.Service.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Newtonsoft.Json;
using static JapaneseFood.Common.Enums.EnumCommons;

namespace vqt_japanese_food_web.Areas.Admin.Controllers
{
    [Area("Admin")]
    public class SignInMngController : Controller
    {
        private readonly DataContext _context;
        private readonly IPasswordService _passwords;
        public SignInMngController(DataContext context, IPasswordService passwords)
        {
            this._context = context;
            this._passwords = passwords;
        }
        public IActionResult Index()
        {
            return View();

        }

        [HttpPost]
        public ActionResult Index(LoginDto model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }
            var entity = _context.Users.FirstOrDefault(z => z.IsActive && !z.IsDelete && z.UserName == model.UserName
                && (z.RoleId == (int)ERoleType.Admin || z.RoleId == (int)ERoleType.Staff));
            var check = entity == null ? PasswordCheck.Failed : _passwords.Verify(entity.Password, model.Password);
            if (entity != null && check == PasswordCheck.SuccessRehashNeeded)
            {
                entity.Password = _passwords.Hash(model.Password);
                _context.SaveChanges();
            }
            var User = entity == null || check == PasswordCheck.Failed ? null : new UserSessionDto()
            {
                Id = entity.Id,
                FullName = entity.FullName,
                UserName = entity.UserName,
                RoleId = entity.RoleId,
                Avatar = entity.Avatar
            };
            if (User != null)
            {
                var session = HttpContext.Session;
                string jsonSave = JsonConvert.SerializeObject(User);
                session.SetString("user_info", jsonSave);
                return RedirectToAction("Index", "HomeMng", new { area = "Admin" });
            }
            else
            {
                TempData["MessagesError"] = "Not found.";
                return View(model);
            }
        }
        public ActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Index", "SignInMng", new { area = "Admin" });
        }
    }
}
