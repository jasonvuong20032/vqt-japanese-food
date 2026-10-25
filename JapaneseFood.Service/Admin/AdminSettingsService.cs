using System.Globalization;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Settings;

namespace JapaneseFood.Service.Admin
{
    public sealed class StoreSettingsInput
    {
        public string StoreName { get; set; } = string.Empty;
        public string StorePhone { get; set; } = string.Empty;
        public string StoreEmail { get; set; } = string.Empty;
        public string StoreAddress { get; set; } = string.Empty;
        public string OpeningHours { get; set; } = string.Empty;
        public decimal ShippingFee { get; set; }
        public decimal FreeShippingThreshold { get; set; }
        public int LowStockThreshold { get; set; }
        /// <summary>e.g. https://vqtjapanesefood.vn, used for the "track your order" button in emails</summary>
        public string WebsiteUrl { get; set; } = string.Empty;
    }

    public interface IAdminSettingsService
    {
        Task<StoreSettingsInput> GetAsync(CancellationToken ct = default);
        Task<StoreSettingsInput> SaveAsync(StoreSettingsInput input, CancellationToken ct = default);
    }

    /// <summary>Typed, validated view over the key/value StoreSettings table (only these keys can be written).</summary>
    public class AdminSettingsService(IStoreSettingsService settings) : IAdminSettingsService
    {
        public async Task<StoreSettingsInput> GetAsync(CancellationToken ct = default)
        {
            var all = await settings.GetAllAsync(ct);
            static decimal Money(string v) => decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : 0;
            return new StoreSettingsInput
            {
                StoreName = all[SettingKeys.StoreName],
                StorePhone = all[SettingKeys.StorePhone],
                StoreEmail = all[SettingKeys.StoreEmail],
                StoreAddress = all[SettingKeys.StoreAddress],
                OpeningHours = all[SettingKeys.OpeningHours],
                ShippingFee = Money(all[SettingKeys.ShippingFee]),
                FreeShippingThreshold = Money(all[SettingKeys.FreeShippingThreshold]),
                LowStockThreshold = int.TryParse(all[SettingKeys.LowStockThreshold], out var low) ? low : 10,
                WebsiteUrl = all[SettingKeys.PublicUrl],
            };
        }

        public async Task<StoreSettingsInput> SaveAsync(StoreSettingsInput input, CancellationToken ct = default)
        {
            var errors = new Dictionary<string, object?>();
            void Required(string field, string? value, int max)
            {
                if (string.IsNullOrWhiteSpace(value)) errors[field] = "required";
                else if (value.Length > max) errors[field] = "too_long";
            }
            Required("storeName", input.StoreName, 100);
            Required("storePhone", input.StorePhone, 30);
            Required("storeEmail", input.StoreEmail, 200);
            Required("storeAddress", input.StoreAddress, 300);
            Required("openingHours", input.OpeningHours, 100);
            if (!errors.ContainsKey("storeEmail") && !input.StoreEmail.Contains('@')) errors["storeEmail"] = "invalid_email";
            if (input.ShippingFee < 0) errors["shippingFee"] = "must_not_be_negative";
            if (input.FreeShippingThreshold < 0) errors["freeShippingThreshold"] = "must_not_be_negative";
            if (input.LowStockThreshold is < 0 or > 1000) errors["lowStockThreshold"] = "must_not_be_negative";
            var website = (input.WebsiteUrl ?? string.Empty).Trim().TrimEnd('/');
            if (!Uri.TryCreate(website, UriKind.Absolute, out var site) || site.Scheme is not ("http" or "https") || website.Length > 200)
                errors["websiteUrl"] = "invalid_url";
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            await settings.SetAsync(new Dictionary<string, string>
            {
                [SettingKeys.StoreName] = input.StoreName.Trim(),
                [SettingKeys.StorePhone] = input.StorePhone.Trim(),
                [SettingKeys.StoreEmail] = input.StoreEmail.Trim(),
                [SettingKeys.StoreAddress] = input.StoreAddress.Trim(),
                [SettingKeys.OpeningHours] = input.OpeningHours.Trim(),
                [SettingKeys.ShippingFee] = input.ShippingFee.ToString(CultureInfo.InvariantCulture),
                [SettingKeys.FreeShippingThreshold] = input.FreeShippingThreshold.ToString(CultureInfo.InvariantCulture),
                [SettingKeys.LowStockThreshold] = input.LowStockThreshold.ToString(CultureInfo.InvariantCulture),
                [SettingKeys.PublicUrl] = website,
            }, ct);
            return await GetAsync(ct);
        }
    }
}
