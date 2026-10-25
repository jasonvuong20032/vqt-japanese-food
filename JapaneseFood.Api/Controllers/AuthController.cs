using JapaneseFood.Api.Auth;
using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController(
        IAuthService auth,
        IRefreshTokenService refreshTokens,
        TokenService tokens,
        JwtOptions jwt) : ControllerBase
    {
        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
        {
            request.Language ??= HttpContext.GetLanguage();
            await auth.RegisterAsync(request, HttpContext.GetLanguage(), ct);
            return Accepted(new { email = request.Email.Trim().ToLowerInvariant() });
        }

        [HttpPost("activate")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthUser>> Activate(ActivateRequest request, CancellationToken ct)
        {
            var user = await auth.ActivateAsync(request, ct);
            await SignInAsync(user, remember: true, ct);
            return user;
        }

        [HttpPost("resend-activation")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResendActivation(EmailRequest request, CancellationToken ct)
        {
            await auth.ResendActivationAsync(request.Email, HttpContext.GetLanguage(), ct);
            return Accepted();
        }

        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthUser>> Login(LoginRequest request, CancellationToken ct)
        {
            var user = await auth.LoginAsync(request, ct);
            await SignInAsync(user, request.RememberMe, ct);
            return user;
        }

        [HttpPost("refresh")]
        public async Task<ActionResult<AuthUser>> Refresh(CancellationToken ct)
        {
            var raw = Request.Cookies[AuthCookies.Refresh];
            var remember = Request.Cookies[AuthCookies.Remember] == "1";
            var result = raw == null
                ? new RefreshResult(RefreshOutcome.Invalid)
                : await refreshTokens.RotateAsync(raw, RefreshLifetime(remember), ct);

            // Another tab refreshed first and the browser already has its new cookies: don't clear them, just retry
            if (result.Outcome == RefreshOutcome.Superseded)
                return Problem(statusCode: 409, title: "Session was refreshed by another request.",
                    extensions: new Dictionary<string, object?> { ["code"] = "refresh_superseded" });

            var user = result.Outcome == RefreshOutcome.Rotated ? await auth.GetUserAsync(result.UserId, ct) : null;
            if (user == null)
            {
                AuthCookies.Clear(Response);
                return Unauthorized();
            }

            var (access, accessExpires) = tokens.CreateAccessToken(user);
            AuthCookies.Set(Response, access, accessExpires, result.Token!.Token, result.Token.ExpiresAt, remember);
            return user;
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout(CancellationToken ct)
        {
            var raw = Request.Cookies[AuthCookies.Refresh];
            if (raw != null) await refreshTokens.RevokeAsync(raw, ct);
            AuthCookies.Clear(Response);
            return NoContent();
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<AuthUser>> Me(CancellationToken ct)
        {
            var user = await auth.GetUserAsync(User.RequireUserId(), ct);
            return user == null ? Unauthorized() : user;
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword(EmailRequest request, CancellationToken ct)
        {
            await auth.RequestPasswordResetAsync(request.Email, HttpContext.GetLanguage(), ct);
            return Accepted();
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
        {
            await auth.ResetPasswordAsync(request, ct);
            AuthCookies.Clear(Response);
            return NoContent();
        }

        [Authorize]
        [HttpPost("change-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
        {
            await auth.ChangePasswordAsync(User.RequireUserId(), request, ct);
            return NoContent();
        }

        private async Task SignInAsync(AuthUser user, bool remember, CancellationToken ct)
        {
            var (access, accessExpires) = tokens.CreateAccessToken(user);
            var refresh = await refreshTokens.IssueAsync(user.Id, RefreshLifetime(remember), ct);
            AuthCookies.Set(Response, access, accessExpires, refresh.Token, refresh.ExpiresAt, remember);
        }

        private TimeSpan RefreshLifetime(bool remember)
            => remember ? TimeSpan.FromDays(jwt.RefreshTokenDays) : TimeSpan.FromHours(jwt.SessionRefreshTokenHours);
    }
}
