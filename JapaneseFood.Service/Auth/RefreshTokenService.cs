using JapaneseFood.Entity;
using JapaneseFood.Entity.User;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace JapaneseFood.Service.Auth
{
    public sealed record IssuedRefreshToken(string Token, DateTime ExpiresAt);

    public enum RefreshOutcome
    {
        Rotated,
        /// <summary>Unknown, expired, logged out, or a replayed (stolen) token. The session is over.</summary>
        Invalid,
        /// <summary>
        /// Another request (e.g. a second browser tab) rotated this token a moment ago. Not an attack:
        /// the browser already holds the new cookie, so the caller should simply retry its request.
        /// </summary>
        Superseded,
    }

    public sealed record RefreshResult(RefreshOutcome Outcome, long UserId = 0, IssuedRefreshToken? Token = null);

    public interface IRefreshTokenService
    {
        Task<IssuedRefreshToken> IssueAsync(long userId, TimeSpan lifetime, CancellationToken ct = default);
        /// <summary>
        /// Exchanges a valid token for a new one (rotation). Presenting an already-rotated token after the
        /// grace period revokes every session of that user: it means the token was stolen and replayed.
        /// </summary>
        Task<RefreshResult> RotateAsync(string token, TimeSpan lifetime, CancellationToken ct = default);
        Task RevokeAsync(string token, CancellationToken ct = default);
        /// <summary>Signs the user out everywhere (account locked, role changed).</summary>
        Task<int> RevokeAllForUserAsync(long userId, CancellationToken ct = default);
    }

    public class RefreshTokenService(DataContext db, TimeProvider clock, ILogger<RefreshTokenService> logger) : IRefreshTokenService
    {
        /// <summary>Window in which reusing a just-rotated token is treated as a benign race between tabs.</summary>
        public static readonly TimeSpan ReuseGracePeriod = TimeSpan.FromSeconds(30);

        public async Task<IssuedRefreshToken> IssueAsync(long userId, TimeSpan lifetime, CancellationToken ct = default)
        {
            var (raw, entity) = Create(userId, lifetime);
            db.RefreshTokens.Add(entity);
            await db.SaveChangesAsync(ct);
            return new IssuedRefreshToken(raw, entity.ExpiresAt);
        }

        public async Task<RefreshResult> RotateAsync(string token, TimeSpan lifetime, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(token)) return new(RefreshOutcome.Invalid);
            var hash = HashToken(token);
            var now = clock.GetUtcNow().UtcDateTime;

            // No tracking: ExecuteUpdate below changes rows behind EF's back, so tracked copies would go stale
            var existing = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
            if (existing == null || existing.ExpiresAt <= now) return new(RefreshOutcome.Invalid);

            if (existing.RevokedAt != null)
            {
                if (existing.ReplacedByHash == null) return new(RefreshOutcome.Invalid); // logged out

                if (now - existing.RevokedAt.Value <= ReuseGracePeriod) return new(RefreshOutcome.Superseded);

                logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking all sessions", existing.UserId);
                await RevokeAllAsync(existing.UserId, now, ct);
                return new(RefreshOutcome.Invalid);
            }

            var (raw, replacement) = Create(existing.UserId, lifetime);

            // Atomic claim: if two requests rotate the same token at once, exactly one wins
            var claimed = await db.RefreshTokens
                .Where(t => t.Id == existing.Id && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.RevokedAt, now)
                    .SetProperty(t => t.ReplacedByHash, replacement.TokenHash), ct);
            if (claimed == 0) return new(RefreshOutcome.Superseded);

            db.RefreshTokens.Add(replacement);
            await db.SaveChangesAsync(ct);
            return new(RefreshOutcome.Rotated, existing.UserId, new IssuedRefreshToken(raw, replacement.ExpiresAt));
        }

        public async Task RevokeAsync(string token, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(token)) return;
            var hash = HashToken(token);
            var now = clock.GetUtcNow().UtcDateTime;
            await db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
        }

        public Task<int> RevokeAllForUserAsync(long userId, CancellationToken ct = default)
            => RevokeAllAsync(userId, clock.GetUtcNow().UtcDateTime, ct);

        internal Task<int> RevokeAllAsync(long userId, DateTime nowUtc, CancellationToken ct)
            => db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, nowUtc), ct);

        private (string Raw, RefreshTokenEntities Entity) Create(long userId, TimeSpan lifetime)
        {
            var raw = Base64Url(RandomNumberGenerator.GetBytes(32));
            var now = clock.GetUtcNow().UtcDateTime;
            return (raw, new RefreshTokenEntities
            {
                UserId = userId,
                TokenHash = HashToken(raw),
                CreatedAt = now,
                ExpiresAt = now.Add(lifetime),
            });
        }

        internal static string HashToken(string token)
            => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        private static string Base64Url(byte[] bytes)
            => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
