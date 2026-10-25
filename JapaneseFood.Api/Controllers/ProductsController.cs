using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Recommendations;
using JapaneseFood.Service.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Route("api/products")]
    public class ProductsController(
        IProductService products,
        IRecommendationService recommendations,
        IReviewService reviews) : ControllerBase
    {
        [HttpGet]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<PagedResult<ProductCard>> Search([FromQuery] ProductQuery query, CancellationToken ct)
            => products.SearchAsync(query, HttpContext.GetLanguage(), ct);

        [HttpGet("best-sellers")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<IReadOnlyList<BestSeller>> BestSellers(long? catalogId, long? categoryId, int limit = 12, CancellationToken ct = default)
            => recommendations.GetBestSellersAsync(catalogId, categoryId, limit, HttpContext.GetLanguage(), ct);

        [HttpGet("{idOrSlug}")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public async Task<ActionResult<ProductDetail>> Get(string idOrSlug, CancellationToken ct)
        {
            var product = await products.GetAsync(idOrSlug, HttpContext.GetLanguage(), ct);
            return product == null ? NotFound() : product;
        }

        [HttpGet("{id:long}/related")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<IReadOnlyList<ProductCard>> Related(long id, int limit = 8, CancellationToken ct = default)
            => recommendations.GetFrequentlyBoughtTogetherAsync(id, limit, HttpContext.GetLanguage(), ct);

        /// <summary>Called by the product page once per visit; kept out of the cached GET so views are counted.</summary>
        [HttpPost("{id:long}/view")]
        public async Task<IActionResult> RecordView(long id, CancellationToken ct)
        {
            await products.RecordViewAsync(id, ct);
            return NoContent();
        }

        [HttpGet("{id:long}/reviews")]
        public async Task<IActionResult> Reviews(long id, int page = 1, int pageSize = 10, CancellationToken ct = default)
        {
            var summary = await reviews.GetSummaryAsync(id, ct);
            var items = await reviews.GetReviewsAsync(id, page, pageSize, ct);
            return Ok(new { summary, reviews = items });
        }

        [Authorize]
        [HttpGet("{id:long}/reviews/eligibility")]
        public async Task<IActionResult> ReviewEligibility(long id, CancellationToken ct)
            => Ok(new { canReview = await reviews.CanReviewAsync(User.RequireUserId(), id, ct) });

        [Authorize]
        [HttpPost("{id:long}/reviews")]
        public async Task<ActionResult<ReviewView>> CreateReview(long id, CreateReviewRequest request, CancellationToken ct)
            => await reviews.CreateAsync(User.RequireUserId(), id, request, ct);
    }
}
