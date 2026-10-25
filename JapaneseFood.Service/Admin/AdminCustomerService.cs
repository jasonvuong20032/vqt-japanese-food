using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Orders;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Admin
{
    public sealed class AdminCustomerQuery
    {
        public string? Search { get; set; }
        /// <summary>all (default) | customer | staff (staff and admins)</summary>
        public string? Role { get; set; }
        /// <summary>all (default) | active | locked | unverified</summary>
        public string? Status { get; set; }
        /// <summary>newest (default) | spent | orders | name</summary>
        public string? Sort { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public sealed record AdminCustomerRow(long Id, string FullName, string Email, string? Phone, string Role, bool IsVerified,
        bool IsLocked, DateTime CreatedAt, int OrderCount, decimal TotalSpent, DateTime? LastOrderAt);

    public sealed record AdminAddress(long Id, string FullName, string Phone, string Street, string? Ward, string? Province, bool IsDefault);

    public sealed record AdminCustomerDetail(AdminCustomerRow Customer, string? PreferredLanguage, IReadOnlyList<AdminAddress> Addresses,
        IReadOnlyList<OrderSummary> RecentOrders);

    public interface IAdminCustomerService
    {
        Task<PagedResult<AdminCustomerRow>> ListAsync(AdminCustomerQuery query, CancellationToken ct = default);
        Task<AdminCustomerDetail?> GetAsync(long id, CancellationToken ct = default);
        /// <summary>Locks or unlocks an account and signs it out everywhere. Nobody can lock themselves.</summary>
        Task SetLockedAsync(long id, bool locked, long actorId, CancellationToken ct = default);
        /// <summary>Admin / Staff / Customer. Nobody changes their own role, and the last admin can't be demoted.</summary>
        Task SetRoleAsync(long id, string role, long actorId, CancellationToken ct = default);
        /// <summary>Staff and admins are added by email: the account must already exist.</summary>
        Task<long> FindByEmailAsync(string email, CancellationToken ct = default);
    }

    public class AdminCustomerService(
        DataContext db,
        IOrderService orders,
        IRefreshTokenService refreshTokens,
        IUserAccessCache access) : IAdminCustomerService
    {
        private static readonly int[] NotRevenue = [(int)EnumCommons.OrderStatus.Cancelled, (int)EnumCommons.OrderStatus.Refunded];

        public async Task<PagedResult<AdminCustomerRow>> ListAsync(AdminCustomerQuery q, CancellationToken ct = default)
        {
            var (page, size) = Paging.Normalize(q.Page, q.PageSize, 20, 100);
            var users = db.Users.AsNoTracking().Where(u => !u.IsDelete);

            users = q.Role switch
            {
                "customer" => users.Where(u => u.RoleId == (int)EnumCommons.ERoleType.Customer),
                "staff" => users.Where(u => u.RoleId == (int)EnumCommons.ERoleType.Admin || u.RoleId == (int)EnumCommons.ERoleType.Staff),
                _ => users,
            };
            users = q.Status switch
            {
                "active" => users.Where(u => u.IsActive && !u.IsLocked),
                "locked" => users.Where(u => u.IsLocked),
                "unverified" => users.Where(u => !u.IsActive),
                _ => users,
            };
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var term = q.Search.Trim();
                users = users.Where(u => u.FullName.Contains(term) || u.UserName.Contains(term) || u.PhoneNumber.Contains(term));
            }

            // Spend and order counts come from the orders table (cancelled/refunded orders don't count as spend)
            var rows = users.Select(u => new
            {
                u.Id, u.FullName, u.UserName, u.PhoneNumber, u.RoleId, u.IsActive, u.IsLocked, u.CreatedAt,
                Orders = db.Orders.Count(o => o.UserId == u.Id && !o.IsDelete),
                Spent = db.Orders.Where(o => o.UserId == u.Id && !o.IsDelete && !NotRevenue.Contains(o.Status)).Sum(o => (decimal?)o.TotalAmount) ?? 0,
                LastOrderAt = db.Orders.Where(o => o.UserId == u.Id && !o.IsDelete).Max(o => (DateTime?)o.CreatedAt),
            });
            rows = q.Sort switch
            {
                "spent" => rows.OrderByDescending(r => r.Spent).ThenByDescending(r => r.Id),
                "orders" => rows.OrderByDescending(r => r.Orders).ThenByDescending(r => r.Id),
                "name" => rows.OrderBy(r => r.FullName),
                _ => rows.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id),
            };

            var total = await users.CountAsync(ct);
            var items = await rows.Skip((page - 1) * size).Take(size).ToListAsync(ct);
            return new PagedResult<AdminCustomerRow>(
                items.Select(r => new AdminCustomerRow(r.Id, r.FullName, r.UserName, r.PhoneNumber, AuthService.RoleName(r.RoleId),
                    r.IsActive, r.IsLocked, r.CreatedAt, r.Orders, r.Spent, r.LastOrderAt)).ToList(),
                page, size, total);
        }

        public async Task<AdminCustomerDetail?> GetAsync(long id, CancellationToken ct = default)
        {
            var row = (await ListOneAsync(id, ct));
            if (row is null) return null;
            var language = await db.Users.Where(u => u.Id == id).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
            var addresses = await db.UserAddresses.AsNoTracking()
                .Where(a => a.UserId == id)
                .OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.CreatedAt)
                .Select(a => new AdminAddress(a.Id, a.FullName, a.Phone, a.Street, a.Ward, a.Province, a.IsDefault))
                .ToListAsync(ct);
            var recent = await orders.GetMyOrdersAsync(id, 1, 10, ct);
            return new AdminCustomerDetail(row, language, addresses, recent.Items);
        }

        private async Task<AdminCustomerRow?> ListOneAsync(long id, CancellationToken ct)
        {
            var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && !x.IsDelete, ct);
            if (u is null) return null;
            var userOrders = db.Orders.AsNoTracking().Where(o => o.UserId == id && !o.IsDelete);
            var count = await userOrders.CountAsync(ct);
            var spent = await userOrders.Where(o => !NotRevenue.Contains(o.Status)).SumAsync(o => (decimal?)o.TotalAmount, ct) ?? 0;
            var last = await userOrders.MaxAsync(o => (DateTime?)o.CreatedAt, ct);
            return new AdminCustomerRow(u.Id, u.FullName, u.UserName, u.PhoneNumber, AuthService.RoleName(u.RoleId), u.IsActive, u.IsLocked,
                u.CreatedAt, count, spent, last);
        }

        public async Task SetLockedAsync(long id, bool locked, long actorId, CancellationToken ct = default)
        {
            if (id == actorId) throw AppException.BadRequest("cannot_change_self", "You can't lock your own account.");
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDelete, ct)
                ?? throw AppException.NotFound("user_not_found", "User not found.");
            if (locked && user.RoleId == (int)EnumCommons.ERoleType.Admin && await IsLastAdminAsync(id, ct))
                throw AppException.Conflict("last_admin", "The store needs at least one active administrator.");

            user.IsLocked = locked;
            await db.SaveChangesAsync(ct);
            if (locked) await refreshTokens.RevokeAllForUserAsync(id, ct);
            access.Invalidate(id);
        }

        public async Task SetRoleAsync(long id, string role, long actorId, CancellationToken ct = default)
        {
            var roleId = role switch
            {
                "Admin" => (int)EnumCommons.ERoleType.Admin,
                "Staff" => (int)EnumCommons.ERoleType.Staff,
                "Customer" => (int)EnumCommons.ERoleType.Customer,
                _ => throw AppException.BadRequest("invalid_role", "Unknown role."),
            };
            if (id == actorId) throw AppException.BadRequest("cannot_change_self", "You can't change your own role.");
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDelete, ct)
                ?? throw AppException.NotFound("user_not_found", "User not found.");
            if (user.RoleId == roleId) return;
            if (user.RoleId == (int)EnumCommons.ERoleType.Admin && await IsLastAdminAsync(id, ct))
                throw AppException.Conflict("last_admin", "The store needs at least one active administrator.");

            user.RoleId = roleId;
            await db.SaveChangesAsync(ct);
            // Old tokens carry the old role: sign the user out so the next sign-in picks up the new one
            await refreshTokens.RevokeAllForUserAsync(id, ct);
            access.Invalidate(id);
        }

        public async Task<long> FindByEmailAsync(string email, CancellationToken ct = default)
        {
            var normalized = email.Trim().ToLowerInvariant();
            return await db.Users.Where(u => u.UserName == normalized && !u.IsDelete).Select(u => (long?)u.Id).FirstOrDefaultAsync(ct)
                ?? throw AppException.NotFound("user_not_found", "No account uses this email. Ask them to register first.");
        }

        private async Task<bool> IsLastAdminAsync(long exceptId, CancellationToken ct)
            => !await db.Users.AnyAsync(u => u.Id != exceptId && !u.IsDelete && !u.IsLocked && u.IsActive
                && u.RoleId == (int)EnumCommons.ERoleType.Admin, ct);
    }
}
