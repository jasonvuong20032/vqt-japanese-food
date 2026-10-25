using JapaneseFood.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace JapaneseFood.Service.Auth
{
    /// <param name="Role">"Admin" | "Staff" | "Customer"; null when the user no longer exists.</param>
    public sealed record UserAccess(string? Role, bool CanSignIn);

    /// <summary>
    /// The user's current role and lock state, cached for a few seconds. Access tokens live 15 minutes, so the
    /// back office checks this on every request: a locked or demoted staff member loses access almost at once
    /// instead of when their token expires.
    /// </summary>
    public interface IUserAccessCache
    {
        Task<UserAccess> GetAsync(long userId, CancellationToken ct = default);
        void Invalidate(long userId);
    }

    public class UserAccessCache(DataContext db, IMemoryCache cache) : IUserAccessCache
    {
        private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);

        private static string Key(long userId) => $"user-access:{userId}";

        public async Task<UserAccess> GetAsync(long userId, CancellationToken ct = default)
        {
            if (cache.TryGetValue(Key(userId), out UserAccess? cached) && cached is not null) return cached;

            var row = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId && !u.IsDelete)
                .Select(u => new { u.RoleId, u.IsActive, u.IsLocked })
                .FirstOrDefaultAsync(ct);
            var access = row is null
                ? new UserAccess(null, false)
                : new UserAccess(AuthService.RoleName(row.RoleId), row.IsActive && !row.IsLocked);
            cache.Set(Key(userId), access, Lifetime);
            return access;
        }

        public void Invalidate(long userId) => cache.Remove(Key(userId));
    }
}
