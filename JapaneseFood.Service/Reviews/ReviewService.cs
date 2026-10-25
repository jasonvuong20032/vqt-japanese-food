using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Common;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Reviews
{
    public sealed record ReviewView(long Id, string AuthorName, int Rating, string? Comment, DateTime CreatedAt, bool VerifiedPurchase);

    public sealed record ReviewSummary(double Average, int Count, IReadOnlyDictionary<int, int> Distribution);

    public sealed class CreateReviewRequest
    {
        public int Rating { get; set; }
        public string? Comment { get; set; }
    }

    public interface IReviewService
    {
        Task<ReviewSummary> GetSummaryAsync(long productId, CancellationToken ct = default);
        Task<PagedResult<ReviewView>> GetReviewsAsync(long productId, int page, int pageSize, CancellationToken ct = default);
        /// <summary>Only customers with a delivered/active order containing the product may review it, once.</summary>
        Task<ReviewView> CreateAsync(long userId, long productId, CreateReviewRequest request, CancellationToken ct = default);
        Task<bool> CanReviewAsync(long userId, long productId, CancellationToken ct = default);
        /// <summary>Recomputes the product's cached rating and review count from its visible reviews.</summary>
        Task RefreshProductRatingAsync(long productId, CancellationToken ct = default);
    }

    public class ReviewService(DataContext db, TimeProvider clock) : IReviewService
    {
        public async Task<ReviewSummary> GetSummaryAsync(long productId, CancellationToken ct = default)
        {
            var counts = await db.Reviews.AsNoTracking()
                .Where(r => r.ProductId == productId && r.IsApproved && !r.IsDelete)
                .GroupBy(r => r.Rating)
                .Select(g => new { Rating = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var total = counts.Sum(c => c.Count);
            var avg = total == 0 ? 0 : Math.Round(counts.Sum(c => c.Rating * c.Count) / (double)total, 1);
            var dist = Enumerable.Range(1, 5).ToDictionary(i => i, i => counts.FirstOrDefault(c => c.Rating == i)?.Count ?? 0);
            return new ReviewSummary(avg, total, dist);
        }

        public async Task<PagedResult<ReviewView>> GetReviewsAsync(long productId, int page, int pageSize, CancellationToken ct = default)
        {
            var (p, size) = Paging.Normalize(page, pageSize, 10, 50);
            var query = db.Reviews.AsNoTracking().Where(r => r.ProductId == productId && r.IsApproved && !r.IsDelete);
            var total = await query.CountAsync(ct);
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((p - 1) * size).Take(size)
                .Select(r => new ReviewView(
                    r.Id,
                    db.Users.Where(u => u.Id == r.UserId).Select(u => u.FullName).FirstOrDefault() ?? "",
                    r.Rating, r.Comment, r.CreatedAt, true))
                .ToListAsync(ct);

            // Show "Nguyễn Văn A" as "Nguyễn V. A." style initials for privacy
            return new PagedResult<ReviewView>(items.Select(i => i with { AuthorName = MaskName(i.AuthorName) }).ToList(), p, size, total);
        }

        public async Task<bool> CanReviewAsync(long userId, long productId, CancellationToken ct = default)
            => await HasPurchasedAsync(userId, productId, ct)
               && !await db.Reviews.AnyAsync(r => r.UserId == userId && r.ProductId == productId && !r.IsDelete, ct);

        public async Task<ReviewView> CreateAsync(long userId, long productId, CreateReviewRequest r, CancellationToken ct = default)
        {
            if (r.Rating is < 1 or > 5)
                throw AppException.BadRequest("validation_failed", "Rating must be 1-5.", new Dictionary<string, object?> { ["rating"] = "invalid" });
            if (r.Comment?.Length > 2000)
                throw AppException.BadRequest("validation_failed", "Comment is too long.", new Dictionary<string, object?> { ["comment"] = "too_long" });
            if (!await HasPurchasedAsync(userId, productId, ct))
                throw AppException.Forbidden("review_requires_purchase", "Only customers who bought this product can review it.");
            if (await db.Reviews.AnyAsync(x => x.UserId == userId && x.ProductId == productId && !x.IsDelete, ct))
                throw AppException.Conflict("review_exists", "You have already reviewed this product.");

            var now = clock.GetLocalNow().DateTime;
            var review = new ReviewEntities
            {
                ProductId = productId,
                UserId = userId,
                Rating = r.Rating,
                Comment = string.IsNullOrWhiteSpace(r.Comment) ? null : r.Comment.Trim(),
                // Verified purchases are published immediately; admins can hide abusive ones later
                IsApproved = true,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
                CreatedBy = userId.ToString(),
            };
            db.Reviews.Add(review);
            await db.SaveChangesAsync(ct);
            await RefreshProductRatingAsync(productId, ct);

            var name = await db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct) ?? "";
            return new ReviewView(review.Id, MaskName(name), review.Rating, review.Comment, review.CreatedAt, true);
        }

        public async Task RefreshProductRatingAsync(long productId, CancellationToken ct = default)
        {
            var stats = await db.Reviews.Where(r => r.ProductId == productId && r.IsApproved && !r.IsDelete)
                .GroupBy(r => 1)
                .Select(g => new { Count = g.Count(), Avg = g.Average(r => (double)r.Rating) })
                .FirstOrDefaultAsync(ct);

            var count = stats?.Count ?? 0;
            var rating = stats == null ? 0 : (int)Math.Round(stats.Avg, MidpointRounding.AwayFromZero);
            await db.Products.Where(p => p.Id == productId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Rating, rating).SetProperty(p => p.ReviewCount, count), ct);
        }

        private Task<bool> HasPurchasedAsync(long userId, long productId, CancellationToken ct)
            => db.Orders.AnyAsync(o => o.UserId == userId && !o.IsDelete
                && o.Status != (int)EnumCommons.OrderStatus.Cancelled
                && o.Details.Any(d => d.ProductId == productId), ct);

        internal static string MaskName(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return "Khách hàng";
            if (parts.Length == 1) return parts[0];
            return string.Join(' ', parts[..^1].Select(p => p[0] + ".")) + " " + parts[^1];
        }
    }
}
