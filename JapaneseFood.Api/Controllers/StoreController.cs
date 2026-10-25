using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Content;
using JapaneseFood.Service.Policies;
using JapaneseFood.Service.Settings;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Route("api")]
    public class StoreController(ICatalogService catalog, IStorePolicyService policies, IStoreSettingsService settings,
        IStoreContentService content, ICreditsService credits) : ControllerBase
    {
        [HttpGet("catalog")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<IReadOnlyList<CatalogNode>> Catalog(CancellationToken ct)
            => catalog.GetTreeAsync(HttpContext.GetLanguage(), ct);

        /// <summary>Store contact info, shipping rules and supported languages for the header/footer/cart.</summary>
        [HttpGet("store")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public async Task<IActionResult> Store(CancellationToken ct)
        {
            var info = await settings.GetStoreInfoAsync(ct);
            var languages = Languages.Supported.Select(code => new { code, name = Languages.NativeNames[code] });
            return Ok(new { info, languages, defaultLanguage = Languages.Default });
        }

        [HttpGet("store/policies")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<IReadOnlyList<PolicyView>> Policies(CancellationToken ct)
            => policies.GetAllAsync(HttpContext.GetLanguage(), ct);

        /// <summary>Attribution for openly licensed photos (CC BY requires crediting the author).</summary>
        [HttpGet("store/credits")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<IReadOnlyList<PhotoCredit>> Credits(CancellationToken ct)
            => credits.GetAsync(HttpContext.GetLanguage(), ct);

        /// <summary>"Our story" page content (JSON authored per language).</summary>
        [HttpGet("store/content/{page}")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public async Task<IActionResult> PageContent(string page, CancellationToken ct)
        {
            var json = await content.GetAsync(page, HttpContext.GetLanguage(), ct);
            return json == null ? NotFound() : Content(json, "application/json");
        }
    }
}
