using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Account;
using JapaneseFood.Service.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/account")]
    public class AccountController(IAccountService account) : ControllerBase
    {
        [HttpGet("profile")]
        public Task<ProfileView> Profile(CancellationToken ct)
            => account.GetProfileAsync(User.RequireUserId(), ct);

        [HttpPut("profile")]
        public Task<ProfileView> UpdateProfile(UpdateProfileRequest request, CancellationToken ct)
            => account.UpdateProfileAsync(User.RequireUserId(), request, ct);

        public sealed record PreferencesRequest(string? Language, string? Theme);

        /// <summary>Remembers language/theme across devices for signed-in users.</summary>
        [HttpPut("preferences")]
        public async Task<IActionResult> Preferences(PreferencesRequest request, CancellationToken ct)
        {
            await account.SetPreferencesAsync(User.RequireUserId(), request.Language, request.Theme, ct);
            return NoContent();
        }

        [HttpGet("addresses")]
        public Task<IReadOnlyList<AddressView>> Addresses(CancellationToken ct)
            => account.GetAddressesAsync(User.RequireUserId(), ct);

        [HttpPost("addresses")]
        public Task<AddressView> CreateAddress(AddressRequest request, CancellationToken ct)
            => account.SaveAddressAsync(User.RequireUserId(), null, request, ct);

        [HttpPut("addresses/{id:long}")]
        public Task<AddressView> UpdateAddress(long id, AddressRequest request, CancellationToken ct)
            => account.SaveAddressAsync(User.RequireUserId(), id, request, ct);

        [HttpDelete("addresses/{id:long}")]
        public async Task<IActionResult> DeleteAddress(long id, CancellationToken ct)
        {
            await account.DeleteAddressAsync(User.RequireUserId(), id, ct);
            return NoContent();
        }

        [HttpGet("wishlist")]
        public Task<IReadOnlyList<ProductCard>> Wishlist(CancellationToken ct)
            => account.GetWishlistAsync(User.RequireUserId(), HttpContext.GetLanguage(), ct);

        [HttpGet("wishlist/ids")]
        public Task<IReadOnlyList<long>> WishlistIds(CancellationToken ct)
            => account.GetWishlistIdsAsync(User.RequireUserId(), ct);

        [HttpPut("wishlist/{productId:long}")]
        public async Task<IActionResult> AddToWishlist(long productId, CancellationToken ct)
        {
            await account.AddToWishlistAsync(User.RequireUserId(), productId, ct);
            return NoContent();
        }

        [HttpDelete("wishlist/{productId:long}")]
        public async Task<IActionResult> RemoveFromWishlist(long productId, CancellationToken ct)
        {
            await account.RemoveFromWishlistAsync(User.RequireUserId(), productId, ct);
            return NoContent();
        }
    }
}
