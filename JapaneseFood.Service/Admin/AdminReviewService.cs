using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Reviews;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed record AdminReview(long Id, long ProductId, string ProductName, string? ProductImage, long UserId, string AuthorName,
        string AuthorEmail, int Rating, string? Comment, bool IsVisible, DateTime CreatedAt);

    public interface IAdminReviewService
    {
        /// <param name="status">all (default) | visible | hidden</param>
        Task<PagedResult<AdminReview>> ListAsync(string? status, int? rating, string? search, int page, int pageSize, CancellationToken ct = default);
        Task<int> SetVisibleAsync(IReadOnlyList<long> ids, bool visible, string by, CancellationToken ct = default);
        Task<int> DeleteAsync(IReadOnlyList<long> ids, string by, CancellationToken ct = default);
    }

    /// <summary>
    /// Reviews are published as soon as a verified buyer writes them; moderation hides, restores or deletes them.
    /// Every change recomputes the products' cached rating so the storefront stays consistent.
    /// </summary>
    public class AdminReviewService(DataContext db, IReviewService reviews, TimeProvider clock) : IAdminReviewService
    {
        public async Task<PagedResult<AdminReview>> ListAsync(string? status, int? rating, string? search, int page, int pageSize, CancellationToken ct = default)
        {
            (page, pageSize) = Paging.Normalize(page, pageSize, 20, 100);
            var query = db.Reviews.AsNoTracking().Where(r => !r.IsDelete);
            query = status switch
            {
                "visible" => query.Where(r => r.IsApproved),
                "hidden" => query.Where(r => !r.IsApproved),
                _ => query,
            };
            if (rating is >= 1 and <= 5) query = query.Where(r => r.Rating == rating);

            var rows = from r in query
                       join p in db.Products on r.ProductId equals p.Id
                       join u in db.Users on r.UserId equals u.Id
                       select new { r, p.Name, Image = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(), u.FullName, u.UserName };
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                rows = rows.Where(x => (x.r.Comment != null && x.r.Comment.Contains(term)) || x.Name.Contains(term) || x.FullName.Contains(term));
            }

            var total = await rows.CountAsync(ct);
            var items = await rows.OrderByDescending(x => x.r.CreatedAt).ThenByDescending(x => x.r.Id)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return new PagedResult<AdminReview>(items.Select(x => new AdminReview(x.r.Id, x.r.ProductId, x.Name, ImageUrls.ToPublic(x.Image),
                x.r.UserId, x.FullName, x.UserName, x.r.Rating, x.r.Comment, x.r.IsApproved, x.r.CreatedAt)).ToList(), page, pageSize, total);
        }

        public Task<int> SetVisibleAsync(IReadOnlyList<long> ids, bool visible, string by, CancellationToken ct = default)
            => UpdateAsync(ids, r => r.IsApproved != visible && !r.IsDelete, setVisible: visible, delete: false, by, ct);

        public Task<int> DeleteAsync(IReadOnlyList<long> ids, string by, CancellationToken ct = default)
            => UpdateAsync(ids, r => !r.IsDelete, setVisible: false, delete: true, by, ct);

        private async Task<int> UpdateAsync(IReadOnlyList<long> ids, System.Linq.Expressions.Expression<Func<Entity.Product.ReviewEntities, bool>> filter,
            bool setVisible, bool delete, string by, CancellationToken ct)
        {
            var list = ids.Distinct().Take(200).ToList();
            var targets = db.Reviews.Where(r => list.Contains(r.Id)).Where(filter);
            var products = await targets.Select(r => r.ProductId).Distinct().ToListAsync(ct);
            var now = clock.GetUtcNow().UtcDateTime;
            var affected = await targets.ExecuteUpdateAsync(s => s
                .SetProperty(r => r.IsApproved, setVisible)
                .SetProperty(r => r.IsDelete, r => delete || r.IsDelete)
                .SetProperty(r => r.UpdatedAt, now)
                .SetProperty(r => r.UpdatedBy, by), ct);
            foreach (var productId in products) await reviews.RefreshProductRatingAsync(productId, ct);
            return affected;
        }
    }
}
