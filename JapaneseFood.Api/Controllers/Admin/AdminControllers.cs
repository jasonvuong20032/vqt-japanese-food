using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Content;
using JapaneseFood.Service.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace JapaneseFood.Api.Controllers.Admin
{
    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/dashboard")]
    public class AdminDashboardController(IDashboardService dashboard) : ControllerBase
    {
        [HttpGet]
        public Task<DashboardView> Get(CancellationToken ct) => dashboard.GetAsync(ct);
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/orders")]
    public class AdminOrdersController(IOrderService orders) : ControllerBase
    {
        [HttpGet]
        public Task<PagedResult<OrderSummary>> List([FromQuery] AdminOrderQuery query, CancellationToken ct)
            => orders.AdminListAsync(query, ct);

        [HttpGet("counts")]
        public Task<IReadOnlyDictionary<int, int>> Counts(CancellationToken ct) => orders.AdminCountsAsync(ct);

        [HttpGet("{id:long}")]
        public async Task<ActionResult<OrderView>> Get(long id, CancellationToken ct)
        {
            var order = await orders.AdminGetAsync(id, ct);
            return order == null ? NotFound() : order;
        }

        public sealed record StatusRequest(int Status, string? Note);

        [HttpPost("{id:long}/status")]
        public Task<OrderView> UpdateStatus(long id, StatusRequest request, CancellationToken ct)
            => orders.UpdateStatusAsync(id, request.Status, request.Note, User.GetActor(), ct);
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/products")]
    public class AdminProductsController(IAdminProductService products, IOutputCacheStore cache, StorageOptions storage)
        : ControllerBase
    {
        [HttpGet]
        public Task<PagedResult<AdminProductRow>> List([FromQuery] AdminProductQuery query, CancellationToken ct)
            => products.ListAsync(query, ct);

        [HttpGet("{id:long}")]
        public async Task<ActionResult<AdminProductEdit>> Get(long id, CancellationToken ct)
        {
            var product = await products.GetAsync(id, ct);
            return product == null ? NotFound() : product;
        }

        [HttpPost]
        public async Task<ActionResult<AdminProductEdit>> Create(AdminProductInput input, CancellationToken ct)
        {
            var created = await products.CreateAsync(input, User.GetActor(), ct);
            await Evict(ct);
            return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
        }

        [HttpPut("{id:long}")]
        public async Task<AdminProductEdit> Update(long id, AdminProductInput input, CancellationToken ct)
        {
            var updated = await products.UpdateAsync(id, input, User.GetActor(), ct);
            await Evict(ct);
            return updated;
        }

        public sealed record BulkRequest(List<long> Ids, string Action);

        [HttpPost("bulk")]
        public async Task<IActionResult> Bulk(BulkRequest request, CancellationToken ct)
        {
            var ids = request.Ids.Distinct().Take(500).ToList();
            var affected = request.Action switch
            {
                "activate" => await products.SetActiveAsync(ids, true, User.GetActor(), ct),
                "deactivate" => await products.SetActiveAsync(ids, false, User.GetActor(), ct),
                "delete" => await products.DeleteAsync(ids, User.GetActor(), ct),
                _ => throw AppException.BadRequest("invalid_action", "Unknown bulk action."),
            };
            await Evict(ct);
            return Ok(new { affected });
        }

        [HttpPost("{id:long}/images")]
        [RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<ActionResult<AdminImage>> UploadImage(long id, IFormFile file, [FromForm] string? alt, CancellationToken ct)
        {
            if (file.Length == 0 || file.Length > storage.MaxImageBytes)
                throw AppException.BadRequest("image_too_large", "Images must be smaller than 5 MB.");

            await using var stream = file.OpenReadStream();
            var image = await products.AddImageAsync(id, stream, Path.GetExtension(file.FileName), alt, ct);
            await Evict(ct);
            return image;
        }

        [HttpDelete("{id:long}/images/{imageId:int}")]
        public async Task<IActionResult> DeleteImage(long id, int imageId, CancellationToken ct)
        {
            await products.DeleteImageAsync(id, imageId, ct);
            await Evict(ct);
            return NoContent();
        }

        [HttpPut("{id:long}/images/order")]
        public async Task<IActionResult> ReorderImages(long id, List<int> imageIds, CancellationToken ct)
        {
            await products.ReorderImagesAsync(id, imageIds, ct);
            await Evict(ct);
            return NoContent();
        }

        private async Task Evict(CancellationToken ct) => await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
    }

    [ApiController]
    [Authorize(Policy = "Admin")]
    [Route("api/admin/content")]
    public class AdminContentController(IStoreContentService content, IOutputCacheStore cache) : ControllerBase
    {
        [HttpGet("{page}/{lang}")]
        public async Task<IActionResult> Get(string page, string lang, CancellationToken ct)
        {
            var json = await content.GetAsync(page, lang, ct);
            return json == null ? NotFound() : Content(json, "application/json");
        }

        /// <summary>Replaces a page's content for one language. Body: the page JSON.</summary>
        [HttpPut("{page}/{lang}")]
        public async Task<IActionResult> Put(string page, string lang, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
        {
            await content.SetAsync(page, lang, body.GetRawText(), ct);
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return NoContent();
        }
    }

    [ApiController]
    [Authorize(Policy = "Staff")]
    [Route("api/admin/catalog")]
    public class AdminCatalogController(IAdminCatalogService catalog, IOutputCacheStore cache) : ControllerBase
    {
        [HttpGet]
        public Task<IReadOnlyList<AdminCatalog>> Tree(CancellationToken ct) => catalog.GetTreeAsync(ct);

        [HttpPost("catalogs")]
        public async Task<IActionResult> CreateCatalog(NameInput input, CancellationToken ct)
            => await Done(new { id = await catalog.SaveCatalogAsync(null, input, User.GetActor(), ct) }, ct);

        [HttpPut("catalogs/{id:long}")]
        public async Task<IActionResult> UpdateCatalog(long id, NameInput input, CancellationToken ct)
            => await Done(new { id = await catalog.SaveCatalogAsync(id, input, User.GetActor(), ct) }, ct);

        [HttpDelete("catalogs/{id:long}")]
        public async Task<IActionResult> DeleteCatalog(long id, CancellationToken ct)
        {
            await catalog.DeleteCatalogAsync(id, User.GetActor(), ct);
            return await Done(null, ct);
        }

        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory(NameInput input, CancellationToken ct)
            => await Done(new { id = await catalog.SaveCategoryAsync(null, input, User.GetActor(), ct) }, ct);

        [HttpPut("categories/{id:long}")]
        public async Task<IActionResult> UpdateCategory(long id, NameInput input, CancellationToken ct)
            => await Done(new { id = await catalog.SaveCategoryAsync(id, input, User.GetActor(), ct) }, ct);

        [HttpDelete("categories/{id:long}")]
        public async Task<IActionResult> DeleteCategory(long id, CancellationToken ct)
        {
            await catalog.DeleteCategoryAsync(id, User.GetActor(), ct);
            return await Done(null, ct);
        }

        private async Task<IActionResult> Done(object? body, CancellationToken ct)
        {
            await cache.EvictByTagAsync(PublicCachePolicy.Tag, ct);
            return body == null ? NoContent() : Ok(body);
        }
    }
}
