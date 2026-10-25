using JapaneseFood.Common.Enums;
using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Settings;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace JapaneseFood.Service.Admin
{
    public sealed record KpiPeriod(decimal Revenue, int Orders, decimal AverageOrderValue);

    public sealed record DailyRevenue(DateTime Date, decimal Revenue, int Orders);

    public sealed record TopProduct(long ProductId, string Name, string? ImageUrl, int UnitsSold, decimal Revenue);

    public sealed record LowStockProduct(long ProductId, string Name, string Code, int Quantity);

    public sealed record DashboardView(
        KpiPeriod Today,
        KpiPeriod Last7Days,
        KpiPeriod Last30Days,
        KpiPeriod Previous30Days,
        int PendingOrders,
        int NewCustomers30Days,
        IReadOnlyList<DailyRevenue> RevenueByDay,
        IReadOnlyList<TopProduct> TopProducts,
        IReadOnlyList<LowStockProduct> LowStock,
        IReadOnlyDictionary<int, int> OrdersByStatus);

    public interface IDashboardService
    {
        Task<DashboardView> GetAsync(CancellationToken ct = default);
    }

    public class DashboardService(DataContext db, IStoreSettingsService settings, TimeProvider clock) : IDashboardService
    {
        public async Task<DashboardView> GetAsync(CancellationToken ct = default)
        {
            var today = clock.GetLocalNow().DateTime.Date;
            var from60 = today.AddDays(-59);

            var revenueOrders = db.Orders.AsNoTracking().Where(o => !o.IsDelete
                && o.Status != (int)EnumCommons.OrderStatus.Cancelled
                && o.Status != (int)EnumCommons.OrderStatus.Refunded);

            var daily = await revenueOrders
                .Where(o => o.CreatedAt >= from60)
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new { Date = g.Key, Revenue = g.Sum(o => o.TotalAmount), Orders = g.Count() })
                .ToListAsync(ct);

            KpiPeriod Period(DateTime fromInclusive, DateTime toExclusive)
            {
                var days = daily.Where(d => d.Date >= fromInclusive && d.Date < toExclusive).ToList();
                var revenue = days.Sum(d => d.Revenue);
                var orders = days.Sum(d => d.Orders);
                return new KpiPeriod(revenue, orders, orders == 0 ? 0 : Math.Round(revenue / orders, 0));
            }

            var tomorrow = today.AddDays(1);
            var revenueByDay = Enumerable.Range(0, 30)
                .Select(i => today.AddDays(-29 + i))
                .Select(d =>
                {
                    var hit = daily.FirstOrDefault(x => x.Date == d);
                    return new DailyRevenue(d, hit?.Revenue ?? 0, hit?.Orders ?? 0);
                })
                .ToList();

            var from30 = today.AddDays(-29);
            var top = await db.OrderDetails.AsNoTracking()
                .Join(revenueOrders.Where(o => o.CreatedAt >= from30), d => d.OrderId, o => o.Id, (d, o) => d)
                .GroupBy(d => d.ProductId)
                .Select(g => new { ProductId = g.Key, Units = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.LineTotal) })
                .OrderByDescending(x => x.Revenue)
                .Take(5)
                .ToListAsync(ct);

            var topIds = top.Select(t => t.ProductId).ToList();
            var topInfo = await db.Products.AsNoTracking()
                .Where(p => topIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, Image = p.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() })
                .ToDictionaryAsync(p => p.Id, ct);

            var all = await settings.GetAllAsync(ct);
            var lowThreshold = int.TryParse(all[SettingKeys.LowStockThreshold], NumberStyles.Integer, CultureInfo.InvariantCulture, out var t) ? t : 10;
            var lowStock = await db.Products.AsNoTracking()
                .Where(p => !p.IsDelete && p.IsActive && p.Quantity <= lowThreshold)
                .OrderBy(p => p.Quantity)
                .Take(10)
                .Select(p => new LowStockProduct(p.Id, p.Name, p.Code, p.Quantity))
                .ToListAsync(ct);

            var byStatus = await db.Orders.AsNoTracking().Where(o => !o.IsDelete)
                .GroupBy(o => o.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count, ct);

            var newCustomers = await db.Users.AsNoTracking().CountAsync(u =>
                u.RoleId == (int)EnumCommons.ERoleType.Customer && u.CreatedAt >= from30, ct);

            return new DashboardView(
                Period(today, tomorrow),
                Period(today.AddDays(-6), tomorrow),
                Period(from30, tomorrow),
                Period(from60, from30),
                byStatus.GetValueOrDefault((int)EnumCommons.OrderStatus.Pending),
                newCustomers,
                revenueByDay,
                top.Select(x => new TopProduct(x.ProductId,
                    topInfo.TryGetValue(x.ProductId, out var info) ? info.Name : $"#{x.ProductId}",
                    ImageUrls.ToPublic(topInfo.GetValueOrDefault(x.ProductId)?.Image),
                    x.Units, x.Revenue)).ToList(),
                lowStock,
                byStatus);
        }
    }
}
