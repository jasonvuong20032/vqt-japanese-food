using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.User;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Email;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Security.Cryptography;

namespace JapaneseFood.Service.Auth
{
    public interface IAuthService
    {
        /// <summary>Creates an inactive account and emails a 6-digit activation code.</summary>
        /// <param name="lang">Site language the visitor is using: the activation email and their saved preference</param>
        Task RegisterAsync(RegisterRequest request, string lang = Languages.Default, CancellationToken ct = default);
        Task<AuthUser> ActivateAsync(ActivateRequest request, CancellationToken ct = default);
        Task ResendActivationAsync(string email, string lang = Languages.Default, CancellationToken ct = default);
        Task<AuthUser> LoginAsync(LoginRequest request, CancellationToken ct = default);
        Task<AuthUser?> GetUserAsync(long userId, CancellationToken ct = default);
        /// <summary>Always succeeds silently so the endpoint can't be used to discover which emails exist.</summary>
        Task RequestPasswordResetAsync(string email, string lang = Languages.Default, CancellationToken ct = default);
        Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
        Task ChangePasswordAsync(long userId, ChangePasswordRequest request, CancellationToken ct = default);
    }

    public class AuthService(
        DataContext db,
        IPasswordService passwords,
        IEmailQueue emails,
        IStoreSettingsService settings,
        TimeProvider clock,
        ILogger<AuthService> logger) : IAuthService
    {
        public static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(30);

        public async Task RegisterAsync(RegisterRequest r, string lang = Languages.Default, CancellationToken ct = default)
        {
            // The page sends the language it is showing; the request header is the fallback
            var language = Languages.Normalize(string.IsNullOrWhiteSpace(r.Language) ? lang : r.Language);
            var email = NormalizeEmail(r.Email);
            var errors = new Dictionary<string, object?>();
            if (email == null) errors["email"] = "invalid_email";
            if (string.IsNullOrWhiteSpace(r.FullName) || r.FullName.Trim().Length > 100) errors["fullName"] = "required";
            if (string.IsNullOrEmpty(OrderService.NormalizePhone(r.Phone))) errors["phone"] = "invalid_phone";
            if (passwords.ValidateStrength(r.Password) is { } pwError) errors["password"] = pwError;
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            var now = clock.GetLocalNow().DateTime;
            var existing = await db.Users.FirstOrDefaultAsync(u => u.UserName == email, ct);
            if (existing is { IsActive: true })
                throw AppException.Conflict("email_taken", "An account with this email already exists.");

            var code = NewNumericCode();
            if (existing != null)
            {
                // Unfinished sign-up: let the person start over instead of being locked out
                existing.Password = passwords.Hash(r.Password);
                existing.FullName = r.FullName.Trim();
                existing.PhoneNumber = OrderService.NormalizePhone(r.Phone);
                existing.ActivationCode = code;
                existing.ActivationCodeExpiresAt = now.Add(CodeLifetime);
                existing.UpdatedAt = now;
            }
            else
            {
                db.Users.Add(new UserEntities
                {
                    UserName = email!,
                    Password = passwords.Hash(r.Password),
                    FullName = r.FullName.Trim(),
                    PhoneNumber = OrderService.NormalizePhone(r.Phone),
                    BirthDate = now.Date,
                    RoleId = (int)EnumCommons.ERoleType.Customer,
                    IsActive = false,
                    ActivationCode = code,
                    ActivationCodeExpiresAt = now.Add(CodeLifetime),
                    PreferredLanguage = language,
                    CreatedAt = now,
                    CreatedBy = email,
                    UpdatedAt = now,
                });
            }

            await db.SaveChangesAsync(ct);
            await SendCodeAsync(email!, r.FullName, code, CodePurpose.Activation, language, ct);
        }

        public async Task<AuthUser> ActivateAsync(ActivateRequest r, CancellationToken ct = default)
        {
            var email = NormalizeEmail(r.Email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == email && !u.IsDelete, ct)
                ?? throw AppException.BadRequest("activation_invalid", "Invalid activation code.");
            if (user.IsActive)
                throw AppException.Conflict("already_active", "This account is already active.");

            var now = clock.GetLocalNow().DateTime;
            if (string.IsNullOrEmpty(user.ActivationCode) || !FixedEquals(user.ActivationCode, r.Code?.Trim()))
                throw AppException.BadRequest("activation_invalid", "Invalid activation code.");
            if (user.ActivationCodeExpiresAt.HasValue && user.ActivationCodeExpiresAt.Value < now)
                throw AppException.BadRequest("activation_expired", "This code has expired. Request a new one.");

            user.IsActive = true;
            user.ActivationCode = null;
            user.ActivationCodeExpiresAt = null;
            user.UpdatedAt = now;
            await db.SaveChangesAsync(ct);
            return ToAuthUser(user);
        }

        public async Task ResendActivationAsync(string email, string lang = Languages.Default, CancellationToken ct = default)
        {
            var normalized = NormalizeEmail(email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == normalized && !u.IsActive && !u.IsDelete, ct);
            if (user == null) return;

            user.ActivationCode = NewNumericCode();
            user.ActivationCodeExpiresAt = clock.GetLocalNow().DateTime.Add(CodeLifetime);
            await db.SaveChangesAsync(ct);
            await SendCodeAsync(user.UserName, user.FullName, user.ActivationCode, CodePurpose.Activation, lang, ct);
        }

        public async Task<AuthUser> LoginAsync(LoginRequest r, CancellationToken ct = default)
        {
            var email = NormalizeEmail(r.Email);
            var user = email == null ? null : await db.Users.FirstOrDefaultAsync(u => u.UserName == email && !u.IsDelete, ct);

            var check = user == null ? PasswordCheck.Failed : passwords.Verify(user.Password, r.Password);
            if (user == null || check == PasswordCheck.Failed)
                throw AppException.Unauthorized("invalid_credentials", "Email or password is incorrect.");

            if (!user.IsActive)
                throw AppException.Forbidden("account_not_active", "Please activate your account first.");

            if (user.IsLocked)
                throw AppException.Forbidden("account_locked", "This account has been locked. Please contact the store.");

            if (check == PasswordCheck.SuccessRehashNeeded)
            {
                user.Password = passwords.Hash(r.Password);
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Upgraded legacy password storage for user {UserId}", user.Id);
            }

            return ToAuthUser(user);
        }

        public async Task<AuthUser?> GetUserAsync(long userId, CancellationToken ct = default)
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && !u.IsLocked && !u.IsDelete, ct);
            return user == null ? null : ToAuthUser(user);
        }

        public async Task RequestPasswordResetAsync(string email, string lang = Languages.Default, CancellationToken ct = default)
        {
            var normalized = NormalizeEmail(email);
            var user = normalized == null ? null
                : await db.Users.FirstOrDefaultAsync(u => u.UserName == normalized && u.IsActive && !u.IsDelete, ct);
            if (user == null) return;

            user.PasswordResetCode = NewNumericCode();
            user.PasswordResetExpiresAt = clock.GetLocalNow().DateTime.Add(CodeLifetime);
            await db.SaveChangesAsync(ct);
            await SendCodeAsync(user.UserName, user.FullName, user.PasswordResetCode, CodePurpose.PasswordReset, lang, ct);
        }

        public async Task ResetPasswordAsync(ResetPasswordRequest r, CancellationToken ct = default)
        {
            if (passwords.ValidateStrength(r.NewPassword) is { } pwError)
                throw AppException.BadRequest("validation_failed", "Password is too weak.",
                    new Dictionary<string, object?> { ["newPassword"] = pwError });

            var email = NormalizeEmail(r.Email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == email && u.IsActive && !u.IsDelete, ct);
            var now = clock.GetLocalNow().DateTime;

            if (user == null || string.IsNullOrEmpty(user.PasswordResetCode)
                || !FixedEquals(user.PasswordResetCode, r.Code?.Trim())
                || user.PasswordResetExpiresAt < now)
                throw AppException.BadRequest("reset_code_invalid", "The reset code is invalid or has expired.");

            user.Password = passwords.Hash(r.NewPassword);
            user.PasswordResetCode = null;
            user.PasswordResetExpiresAt = null;
            user.UpdatedAt = now;

            // Sign out every device: a reset usually means the old password was compromised
            var nowUtc = clock.GetUtcNow().UtcDateTime;
            await db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, nowUtc), ct);
            await db.SaveChangesAsync(ct);
        }

        public async Task ChangePasswordAsync(long userId, ChangePasswordRequest r, CancellationToken ct = default)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && !u.IsDelete, ct)
                ?? throw AppException.NotFound("user_not_found", "User not found.");

            if (passwords.Verify(user.Password, r.CurrentPassword) == PasswordCheck.Failed)
                throw AppException.BadRequest("validation_failed", "Current password is incorrect.",
                    new Dictionary<string, object?> { ["currentPassword"] = "wrong_password" });
            if (passwords.ValidateStrength(r.NewPassword) is { } pwError)
                throw AppException.BadRequest("validation_failed", "Password is too weak.",
                    new Dictionary<string, object?> { ["newPassword"] = pwError });

            user.Password = passwords.Hash(r.NewPassword);
            user.UpdatedAt = clock.GetLocalNow().DateTime;
            await db.SaveChangesAsync(ct);
        }

        public static string RoleName(int roleId) => (EnumCommons.ERoleType)roleId switch
        {
            EnumCommons.ERoleType.Admin => "Admin",
            EnumCommons.ERoleType.Staff => "Staff",
            _ => "Customer",
        };

        internal static AuthUser ToAuthUser(UserEntities u) => new(
            u.Id, u.UserName, u.FullName, u.PhoneNumber, u.Address, ImageUrls.ToPublic(u.Avatar),
            u.RoleId, RoleName(u.RoleId), u.PreferredLanguage, u.PreferredTheme);

        internal static string? NormalizeEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;
            var trimmed = email.Trim().ToLowerInvariant();
            return trimmed.Length <= 256 && System.Net.Mail.MailAddress.TryCreate(trimmed, out var addr) && addr.Address == trimmed
                ? trimmed
                : null;
        }

        private static string NewNumericCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        private static bool FixedEquals(string a, string? b)
            => b != null && CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(a), System.Text.Encoding.UTF8.GetBytes(b));

        private async Task SendCodeAsync(string to, string? fullName, string code, CodePurpose purpose, string lang, CancellationToken ct)
        {
            var store = await settings.GetStoreInfoAsync(ct);
            emails.Enqueue(EmailTemplates.Code(to, fullName, code, purpose, CodeLifetime, store, Languages.Normalize(lang)));
        }
    }
}
