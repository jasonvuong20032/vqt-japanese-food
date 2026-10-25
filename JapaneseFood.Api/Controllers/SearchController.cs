using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Service.Search;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace JapaneseFood.Api.Controllers
{
    [ApiController]
    [Route("api/search")]
    public class SearchController(ISearchService search) : ControllerBase
    {
        /// <summary>Instant results while typing. Cached per query + language, so popular searches cost nothing.</summary>
        [HttpGet("suggest")]
        [OutputCache(PolicyName = PublicCachePolicy.Name)]
        public Task<SearchSuggestions> Suggest(string q = "", int limit = 6, CancellationToken ct = default)
            => search.SuggestAsync(q.Length > 100 ? q[..100] : q, HttpContext.GetLanguage(), limit, ct);
    }
}
