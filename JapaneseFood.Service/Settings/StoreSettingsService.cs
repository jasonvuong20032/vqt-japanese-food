using JapaneseFood.Entity;
using JapaneseFood.Entity.Store;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;

namespace JapaneseFood.Service.Settings
{
    public static class SettingKeys
    {
        public const string StoreName = "Store.Name";
        public const string StorePhone = "Store.Phone";
        public const string StoreEmail = "Store.Email";
        public const string StoreAddress = "Store.Address";
        public const string OpeningHours = "Store.OpeningHours";
        public const string ShippingFee = "Shipping.Fee";
        public const string FreeShippingThreshold = "Shipping.FreeThreshold";
        public const string LowStockThreshold = "Inventory.LowStockThreshold";
        /// <summary>Public address of the website, used for links in customer emails</summary>
        public const string PublicUrl = "Store.PublicUrl";

        public static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
        {
            [StoreName] = "VQT Japanese Food",
            [StorePhone] = "0900 000 000",
            [StoreEmail] = "studysendmail993@gmail.com",
            [StoreAddress] = "Hồ Chí Minh, Việt Nam",
            [OpeningHours] = "10:00 - 22:00",
            [ShippingFee] = "30000",
            [FreeShippingThreshold] = "500000",
            [LowStockThreshold] = "10",
            [PublicUrl] = "http://localhost:5080",
        };
    }

    public sealed record ShippingSettings(decimal Fee, decimal FreeThreshold);

    public sealed record StoreInfo(string Name, string Phone, string Email, string Address, string OpeningHours,
        decimal ShippingFee, decimal FreeShippingThreshold, string PublicUrl = "");

    public interface IStoreSettingsService
    {
        Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default);
        Task<ShippingSettings> GetShippingAsync(CancellationToken ct = default);
        Task<StoreInfo> GetStoreInfoAsync(CancellationToken ct = default);
        Task SetAsync(IReadOnlyDictionary<string, string> values, CancellationToken ct = default);
    }

    public class StoreSettingsService(DataContext db, IMemoryCache cache, TimeProvider clock) : IStoreSettingsService
    {
        private const string CacheKey = "store-settings";

        public async Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default)
        {
            var stored = await cache.GetOrCreateAsync(CacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await db.StoreSettings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value ?? string.Empty, ct);
            }) ?? new Dictionary<string, string>();

            var merged = new Dictionary<string, string>(SettingKeys.Defaults);
            foreach (var (k, v) in stored) merged[k] = v;
            return merged;
        }

        public async Task<ShippingSettings> GetShippingAsync(CancellationToken ct = default)
        {
            var all = await GetAllAsync(ct);
            return new ShippingSettings(ParseMoney(all[SettingKeys.ShippingFee]), ParseMoney(all[SettingKeys.FreeShippingThreshold]));
        }

        public async Task<StoreInfo> GetStoreInfoAsync(CancellationToken ct = default)
        {
            var all = await GetAllAsync(ct);
            return new StoreInfo(all[SettingKeys.StoreName], all[SettingKeys.StorePhone], all[SettingKeys.StoreEmail],
                all[SettingKeys.StoreAddress], all[SettingKeys.OpeningHours],
                ParseMoney(all[SettingKeys.ShippingFee]), ParseMoney(all[SettingKeys.FreeShippingThreshold]), all[SettingKeys.PublicUrl]);
        }

        public async Task SetAsync(IReadOnlyDictionary<string, string> values, CancellationToken ct = default)
        {
            var keys = values.Keys.ToList();
            var existing = await db.StoreSettings.Where(s => keys.Contains(s.Key)).ToListAsync(ct);
            var now = clock.GetLocalNow().DateTime;
            foreach (var (key, value) in values)
            {
                var row = existing.FirstOrDefault(e => e.Key == key);
                if (row == null)
                    db.StoreSettings.Add(new StoreSettingEntities { Key = key, Value = value, UpdatedAt = now });
                else
                {
                    row.Value = value;
                    row.UpdatedAt = now;
                }
            }
            await db.SaveChangesAsync(ct);
            cache.Remove(CacheKey);
        }

        private static decimal ParseMoney(string value)
            => decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) && d >= 0 ? d : 0;
    }
}
