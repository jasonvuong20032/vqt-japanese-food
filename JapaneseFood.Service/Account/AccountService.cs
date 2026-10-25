using JapaneseFood.Entity;
using JapaneseFood.Entity.Product;
using JapaneseFood.Entity.User;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Products;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Service.Account
{
    public sealed class UpdateProfileRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public DateTime? BirthDate { get; set; }
        public int Gender { get; set; }
        public string? Address { get; set; }
        public string? PreferredLanguage { get; set; }
        public string? PreferredTheme { get; set; }
    }

    public sealed class AddressRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Province { get; set; }
        public string? District { get; set; }
        public string? Ward { get; set; }
        public string Street { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
    }

    public sealed record AddressView(long Id, string FullName, string Phone, string? Province, string? District,
        string? Ward, string Street, bool IsDefault);

    public sealed record ProfileView(AuthUser User, DateTime? BirthDate, int Gender);

    public interface IAccountService
    {
        Task<ProfileView> GetProfileAsync(long userId, CancellationToken ct = default);
        Task<ProfileView> UpdateProfileAsync(long userId, UpdateProfileRequest request, CancellationToken ct = default);
        Task SetPreferencesAsync(long userId, string? language, string? theme, CancellationToken ct = default);

        Task<IReadOnlyList<AddressView>> GetAddressesAsync(long userId, CancellationToken ct = default);
        Task<AddressView> SaveAddressAsync(long userId, long? addressId, AddressRequest request, CancellationToken ct = default);
        Task DeleteAddressAsync(long userId, long addressId, CancellationToken ct = default);

        Task<IReadOnlyList<ProductCard>> GetWishlistAsync(long userId, string lang, CancellationToken ct = default);
        Task<IReadOnlyList<long>> GetWishlistIdsAsync(long userId, CancellationToken ct = default);
        Task AddToWishlistAsync(long userId, long productId, CancellationToken ct = default);
        Task RemoveFromWishlistAsync(long userId, long productId, CancellationToken ct = default);
    }

    public class AccountService(DataContext db, IProductService products, TimeProvider clock) : IAccountService
    {
        public static readonly IReadOnlyList<string> Themes = ["light", "dark", "ocean", "midnight"];
        public const int MaxAddresses = 10;

        public async Task<ProfileView> GetProfileAsync(long userId, CancellationToken ct = default)
        {
            var user = await FindUserAsync(userId, ct);
            return ToProfile(user);
        }

        public async Task<ProfileView> UpdateProfileAsync(long userId, UpdateProfileRequest r, CancellationToken ct = default)
        {
            var errors = new Dictionary<string, object?>();
            if (string.IsNullOrWhiteSpace(r.FullName) || r.FullName.Trim().Length > 100) errors["fullName"] = "required";
            if (string.IsNullOrEmpty(OrderService.NormalizePhone(r.Phone))) errors["phone"] = "invalid_phone";
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            var user = await FindUserAsync(userId, ct);
            user.FullName = r.FullName.Trim();
            user.PhoneNumber = OrderService.NormalizePhone(r.Phone);
            if (r.BirthDate.HasValue) user.BirthDate = r.BirthDate.Value.Date;
            user.Gender = r.Gender;
            user.Address = r.Address?.Trim();
            ApplyPreferences(user, r.PreferredLanguage, r.PreferredTheme);
            user.UpdatedAt = clock.GetLocalNow().DateTime;
            await db.SaveChangesAsync(ct);
            return ToProfile(user);
        }

        public async Task SetPreferencesAsync(long userId, string? language, string? theme, CancellationToken ct = default)
        {
            var user = await FindUserAsync(userId, ct);
            ApplyPreferences(user, language, theme);
            await db.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<AddressView>> GetAddressesAsync(long userId, CancellationToken ct = default)
            => await db.UserAddresses.AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.CreatedAt)
                .Select(a => new AddressView(a.Id, a.FullName, a.Phone, a.Province, a.District, a.Ward, a.Street, a.IsDefault))
                .ToListAsync(ct);

        public async Task<AddressView> SaveAddressAsync(long userId, long? addressId, AddressRequest r, CancellationToken ct = default)
        {
            var errors = new Dictionary<string, object?>();
            if (string.IsNullOrWhiteSpace(r.FullName)) errors["fullName"] = "required";
            if (string.IsNullOrEmpty(OrderService.NormalizePhone(r.Phone))) errors["phone"] = "invalid_phone";
            if (string.IsNullOrWhiteSpace(r.Street)) errors["street"] = "required";
            if (string.IsNullOrWhiteSpace(r.Province)) errors["province"] = "required";
            if (errors.Count > 0) throw AppException.BadRequest("validation_failed", "Please check the highlighted fields.", errors);

            UserAddressEntities address;
            if (addressId.HasValue)
            {
                address = await db.UserAddresses.FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId, ct)
                    ?? throw AppException.NotFound("address_not_found", "Address not found.");
            }
            else
            {
                var count = await db.UserAddresses.CountAsync(a => a.UserId == userId, ct);
                if (count >= MaxAddresses)
                    throw AppException.BadRequest("too_many_addresses", $"You can save up to {MaxAddresses} addresses.");
                address = new UserAddressEntities
                {
                    UserId = userId, FullName = "", Phone = "", Street = "",
                    CreatedAt = clock.GetLocalNow().DateTime,
                    IsDefault = count == 0,
                };
                db.UserAddresses.Add(address);
            }

            address.FullName = r.FullName.Trim();
            address.Phone = OrderService.NormalizePhone(r.Phone);
            address.Province = r.Province?.Trim();
            address.District = r.District?.Trim();
            address.Ward = r.Ward?.Trim();
            address.Street = r.Street.Trim();

            if (r.IsDefault && !address.IsDefault)
            {
                await db.UserAddresses.Where(a => a.UserId == userId && a.IsDefault)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false), ct);
                address.IsDefault = true;
            }

            await db.SaveChangesAsync(ct);
            return new AddressView(address.Id, address.FullName, address.Phone, address.Province, address.District,
                address.Ward, address.Street, address.IsDefault);
        }

        public async Task DeleteAddressAsync(long userId, long addressId, CancellationToken ct = default)
        {
            var address = await db.UserAddresses.FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId, ct);
            if (address == null) return;
            db.UserAddresses.Remove(address);
            await db.SaveChangesAsync(ct);

            if (address.IsDefault)
            {
                var next = await db.UserAddresses.Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).FirstOrDefaultAsync(ct);
                if (next != null)
                {
                    next.IsDefault = true;
                    await db.SaveChangesAsync(ct);
                }
            }
        }

        public async Task<IReadOnlyList<ProductCard>> GetWishlistAsync(long userId, string lang, CancellationToken ct = default)
        {
            var ids = await db.Wishlists.AsNoTracking()
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => w.ProductId)
                .ToListAsync(ct);
            return await products.GetCardsAsync(ids, lang, ct);
        }

        public async Task<IReadOnlyList<long>> GetWishlistIdsAsync(long userId, CancellationToken ct = default)
            => await db.Wishlists.AsNoTracking().Where(w => w.UserId == userId).Select(w => w.ProductId).ToListAsync(ct);

        public async Task AddToWishlistAsync(long userId, long productId, CancellationToken ct = default)
        {
            if (await db.Wishlists.AnyAsync(w => w.UserId == userId && w.ProductId == productId, ct)) return;
            if (!await db.Products.AnyAsync(p => p.Id == productId && !p.IsDelete && p.IsActive, ct))
                throw AppException.NotFound("product_not_found", "Product not found.");

            db.Wishlists.Add(new WishlistEntities { UserId = userId, ProductId = productId, CreatedAt = clock.GetLocalNow().DateTime });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Double-click race hit the unique index: already in the wishlist, which is what was asked
            }
        }

        public async Task RemoveFromWishlistAsync(long userId, long productId, CancellationToken ct = default)
            => await db.Wishlists.Where(w => w.UserId == userId && w.ProductId == productId).ExecuteDeleteAsync(ct);

        private async Task<UserEntities> FindUserAsync(long userId, CancellationToken ct)
            => await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && !u.IsDelete, ct)
                ?? throw AppException.NotFound("user_not_found", "User not found.");

        private static void ApplyPreferences(UserEntities user, string? language, string? theme)
        {
            if (!string.IsNullOrWhiteSpace(language)) user.PreferredLanguage = Languages.Normalize(language);
            if (!string.IsNullOrWhiteSpace(theme) && Themes.Contains(theme)) user.PreferredTheme = theme;
        }

        private static ProfileView ToProfile(UserEntities u)
            => new(AuthService.ToAuthUser(u), u.BirthDate == default ? null : u.BirthDate, u.Gender);
    }
}
