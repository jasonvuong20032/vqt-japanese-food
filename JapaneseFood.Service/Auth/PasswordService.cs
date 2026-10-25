using JapaneseFood.Entity.User;
using Microsoft.AspNetCore.Identity;
using System.Security.Cryptography;
using System.Text;

namespace JapaneseFood.Service.Auth
{
    public enum PasswordCheck
    {
        Failed,
        Success,
        /// <summary>Correct, but stored in a legacy/weak format: caller should save <see cref="IPasswordService.Hash"/>.</summary>
        SuccessRehashNeeded,
    }

    public interface IPasswordService
    {
        string Hash(string password);
        PasswordCheck Verify(string storedPassword, string providedPassword);
        /// <summary>Null when acceptable, otherwise an error code for the frontend.</summary>
        string? ValidateStrength(string password);
    }

    public class PasswordService : IPasswordService
    {
        private static readonly PasswordHasher<UserEntities> Hasher = new();
        private static readonly UserEntities Dummy = new() { UserName = "", Password = "", FullName = "", PhoneNumber = "" };

        public string Hash(string password) => Hasher.HashPassword(Dummy, password);

        public PasswordCheck Verify(string storedPassword, string providedPassword)
        {
            if (string.IsNullOrEmpty(storedPassword) || string.IsNullOrEmpty(providedPassword))
                return PasswordCheck.Failed;

            if (LooksHashed(storedPassword))
            {
                return Hasher.VerifyHashedPassword(Dummy, storedPassword, providedPassword) switch
                {
                    PasswordVerificationResult.Success => PasswordCheck.Success,
                    PasswordVerificationResult.SuccessRehashNeeded => PasswordCheck.SuccessRehashNeeded,
                    _ => PasswordCheck.Failed,
                };
            }

            // Legacy rows from the MVC app stored the password in plain text. Accept once, then the caller re-hashes.
            // Only reached when the stored value is NOT a hash, so knowing a hash never lets anyone log in with it.
            var matches = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(storedPassword), Encoding.UTF8.GetBytes(providedPassword));
            return matches ? PasswordCheck.SuccessRehashNeeded : PasswordCheck.Failed;
        }

        public string? ValidateStrength(string password)
        {
            if (string.IsNullOrEmpty(password) || password.Length < 8) return "password_too_short";
            if (password.Length > 128) return "password_too_long";
            if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit)) return "password_too_weak";
            return null;
        }

        /// <summary>ASP.NET Identity V2 (0x00, 49 bytes) or V3 (0x01, ≥ 61 bytes) base64 hash.</summary>
        internal static bool LooksHashed(string stored)
        {
            if (stored.Length < 64) return false;
            Span<byte> buffer = stackalloc byte[stored.Length];
            if (!Convert.TryFromBase64String(stored, buffer, out var written)) return false;
            return (buffer[0] == 0x00 && written == 49) || (buffer[0] == 0x01 && written >= 61);
        }
    }
}
