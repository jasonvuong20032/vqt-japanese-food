using JapaneseFood.Service.Auth;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

namespace JapaneseFood.Api.Auth
{
    public sealed class JwtOptions
    {
        public string Issuer { get; set; } = "vqt-japanese-food";
        public string Audience { get; set; } = "vqt-japanese-food-web";
        /// <summary>HMAC-SHA256 signing key, at least 32 characters. Keep it in user-secrets / environment variables.</summary>
        public string Key { get; set; } = string.Empty;
        public int AccessTokenMinutes { get; set; } = 15;
        public int RefreshTokenDays { get; set; } = 30;
        /// <summary>Refresh lifetime when "remember me" is off.</summary>
        public int SessionRefreshTokenHours { get; set; } = 24;

        public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
    }

    public sealed class TokenService(JwtOptions options, TimeProvider clock)
    {
        private readonly JsonWebTokenHandler _handler = new();

        public (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(AuthUser user)
        {
            var now = clock.GetUtcNow();
            var expires = now.AddMinutes(options.AccessTokenMinutes);
            var token = _handler.CreateToken(new SecurityTokenDescriptor
            {
                Issuer = options.Issuer,
                Audience = options.Audience,
                IssuedAt = now.UtcDateTime,
                NotBefore = now.UtcDateTime,
                Expires = expires.UtcDateTime,
                SigningCredentials = new SigningCredentials(options.SigningKey(), SecurityAlgorithms.HmacSha256),
                Subject = new ClaimsIdentity(
                [
                    new Claim("sub", user.Id.ToString()),
                    new Claim("email", user.Email),
                    new Claim("name", user.FullName),
                    new Claim("role", user.Role),
                ]),
            });
            return (token, expires);
        }
    }
}
