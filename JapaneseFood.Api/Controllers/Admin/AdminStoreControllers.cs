using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Ai;
using JapaneseFood.Service.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.RateLimiting;

namespace JapaneseFood.Api.Controllers.Admin
{
    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/customers")]
    public class AdminCustomersController(IAdminCustomerService customers) : ControllerBase
    {
        [HttpGet]
        public Task<PagedResult<AdminCustomerRow>> List([FromQuery] AdminCustomerQuery query, CancellationToken ct)
            => customers.ListAsync(query, ct);

        [HttpGet("{id:long}")]
        public async Task<ActionResult<AdminCustomerDetail>> Get(long id, CancellationToken ct)
            => await customers.GetAsync(id, ct) is { } detail ? detail : NotFound();

        public sealed record LockRequest(bool Locked);

        [HttpPost("{id:long}/lock")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Lock(long id, LockRequest request, CancellationToken ct)
        {
            await customers.SetLockedAsync(id, request.Locked, User.RequireUserId(), ct);
            return NoContent();
        }

        public sealed record RoleRequest(string Role);

        [HttpPost("{id:long}/role")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Role(long id, RoleRequest request, CancellationToken ct)
        {
            await customers.SetRoleAsync(id, request.Role, User.RequireUserId(), ct);
            return NoContent();
        }

        public sealed record StaffRequest(string Email, string Role);

        /// <summary>Gives an existing account a staff or admin role, by email.</summary>
        [HttpPost("staff")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> AddStaff(StaffRequest request, CancellationToken ct)
        {
            var id = await customers.FindByEmailAsync(request.Email, ct);
            await customers.SetRoleAsync(id, request.Role, User.RequireUserId(), ct);
            return Ok(new { id });
        }
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/coupons")]
    public class AdminCouponsController(IAdminCouponService coupons) : ControllerBase
    {
        [HttpGet]
        public Task<PagedResult<AdminCoupon>> List(string? search, string? state, int page = 1, int pageSize = 20, CancellationToken ct = default)
            => coupons.ListAsync(search, state, page, pageSize, ct);

        [HttpPost]
        public Task<AdminCoupon> Create(CouponInput input, CancellationToken ct) => coupons.SaveAsync(null, input, User.GetActor(), ct);

        [HttpPut("{id:long}")]
        public Task<AdminCoupon> Update(long id, CouponInput input, CancellationToken ct) => coupons.SaveAsync(id, input, User.GetActor(), ct);

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id, CancellationToken ct)
        {
            await coupons.DeleteAsync(id, User.GetActor(), ct);
            return NoContent();
        }
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/reviews")]
    public class AdminReviewsController(IAdminReviewService reviews, IOutputCacheStore cache) : ControllerBase
    {
        [HttpGet]
        public Task<PagedResult<AdminReview>> List(string? status, int? rating, string? search, int page = 1, int pageSize = 20, CancellationToken ct = default)
            => reviews.ListAsync(status, rating, search, page, pageSize, ct);

        public sealed record BulkRequest(List<long> Ids, string Action);

        [HttpPost("bulk")]
        public async Task<IActionResult> Bulk(BulkRequest request, CancellationToken ct)
        {
            var affected = request.Action switch
            {
                "show" => await reviews.SetVisibleAsync(request.Ids, true, User.GetActor(), ct),
                "hide" => await reviews.SetVisibleAsync(request.Ids, false, User.GetActor(), ct),
                "delete" => await reviews.DeleteAsync(request.Ids, User.GetActor(), ct),
                _ => throw AppException.BadRequest("invalid_action", "Unknown bulk action."),
            };
            // Ratings on product cards are output-cached
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return Ok(new { affected });
        }
    }

    // Staff may read policies; only admins change them. Authorize attributes stack (all must pass),
    // so the stricter policy goes on the write actions rather than on the class.
    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/policies")]
    public class AdminPoliciesController(IAdminPolicyService policies, IOutputCacheStore cache) : ControllerBase
    {
        [HttpGet]
        public Task<IReadOnlyList<AdminPolicy>> List(CancellationToken ct) => policies.ListAsync(ct);

        [HttpPost]
        [Authorize(Policy = "Admin")]
        public async Task<AdminPolicy> Create(PolicyInput input, CancellationToken ct)
        {
            var saved = await policies.SaveAsync(null, input, User.GetActor(), ct);
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return saved;
        }

        [HttpPut("{id:long}")]
        [Authorize(Policy = "Admin")]
        public async Task<AdminPolicy> Update(long id, PolicyInput input, CancellationToken ct)
        {
            var saved = await policies.SaveAsync(id, input, User.GetActor(), ct);
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return saved;
        }

        [HttpDelete("{id:long}")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Delete(long id, CancellationToken ct)
        {
            await policies.DeleteAsync(id, User.GetActor(), ct);
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return NoContent();
        }
    }

    [ApiController]
    [Authorize(Policy = "Admin")]
    [Route("api/admin/settings")]
    public class AdminSettingsController(IAdminSettingsService settings, IOutputCacheStore cache) : ControllerBase
    {
        [HttpGet]
        public Task<StoreSettingsInput> Get(CancellationToken ct) => settings.GetAsync(ct);

        [HttpPut]
        public async Task<StoreSettingsInput> Put(StoreSettingsInput input, CancellationToken ct)
        {
            var saved = await settings.SaveAsync(input, ct);
            // Store name, hours and delivery fees are shown in the output-cached /api/store
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return saved;
        }
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin")]
    public class AdminAiController(IAiTranslator translator) : ControllerBase
    {
        /// <summary>What this back office can do on this server (AI features need an Anthropic key).</summary>
        [HttpGet("capabilities")]
        public IActionResult Capabilities() => Ok(new { aiTranslate = translator.IsConfigured });

        public sealed record TranslateBody(string Kind, Dictionary<string, string> Fields, List<string> Targets);

        [HttpPost("translate")]
        [EnableRateLimiting("ai")]
        public Task<TranslateResult> Translate(TranslateBody body, CancellationToken ct)
            => translator.TranslateAsync(new TranslateRequest(body.Kind, body.Fields, body.Targets), ct);
    }
}
