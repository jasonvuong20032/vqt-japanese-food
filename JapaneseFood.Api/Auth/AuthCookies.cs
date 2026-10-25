namespace JapaneseFood.Api.Auth
{
    /// <summary>
    /// Tokens live in HttpOnly cookies, never in JS-readable storage, so an XSS bug can't steal a session.
    /// SameSite=Lax/Strict means cross-site POSTs don't carry them (CSRF protection for state-changing calls).
    /// </summary>
    public static class AuthCookies
    {
        public const string Access = "jf_at";
        public const string Refresh = "jf_rt";
        public const string Remember = "jf_rm";
        /// <summary>
        /// Non-secret, JS-readable "a session probably exists" hint. Lets the SPA skip the /me round-trip for
        /// anonymous visitors. It grants nothing: every API call is still authorised by the HttpOnly tokens.
        /// </summary>
        public const string SessionHint = "jf_si";
        private const string RefreshPath = "/api/auth";

        public static void Set(HttpResponse response, string accessToken, DateTimeOffset accessExpires,
            string refreshToken, DateTimeOffset refreshExpires, bool remember)
        {
            var secure = response.HttpContext.Request.IsHttps;

            response.Cookies.Append(Access, accessToken, new CookieOptions
            {
                HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Lax, Path = "/", Expires = accessExpires,
                IsEssential = true,
            });

            var refreshOptions = new CookieOptions
            {
                HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = RefreshPath, IsEssential = true,
                // Without "remember me" the cookie dies with the browser session
                Expires = remember ? refreshExpires : null,
            };
            response.Cookies.Append(Refresh, refreshToken, refreshOptions);

            if (remember) response.Cookies.Append(Remember, "1", refreshOptions);
            else response.Cookies.Delete(Remember, new CookieOptions { Path = RefreshPath });

            response.Cookies.Append(SessionHint, "1", new CookieOptions
            {
                HttpOnly = false, Secure = secure, SameSite = SameSiteMode.Lax, Path = "/", IsEssential = true,
                Expires = remember ? refreshExpires : null,
            });
        }

        public static void Clear(HttpResponse response)
        {
            response.Cookies.Delete(Access, new CookieOptions { Path = "/" });
            response.Cookies.Delete(Refresh, new CookieOptions { Path = RefreshPath });
            response.Cookies.Delete(Remember, new CookieOptions { Path = RefreshPath });
            response.Cookies.Delete(SessionHint, new CookieOptions { Path = "/" });
        }
    }
}
