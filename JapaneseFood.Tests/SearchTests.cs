using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Search;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Tests
{
    public class SearchNormalizerTests
    {
        [Theory]
        [InlineData("Cá Hồi Nướng", "ca hoi nuong")]
        [InlineData("  Đậu   phụ  ", "dau phu")]
        [InlineData("Saint-Jacques (beurre)", "saint jacques beurre")]
        [InlineData("大トロ刺身", "大トロ刺身")]
        [InlineData("연어 니기리", "연어 니기리")]
        [InlineData("a|b", "ab")] // "|" is reserved as the SearchName separator
        public void Folds_accents_case_and_punctuation(string input, string expected)
            => Assert.Equal(expected, SearchNormalizer.Normalize(input));

        [Fact]
        public void Terms_are_deduplicated_and_capped()
        {
            Assert.Equal(["sushi", "ca", "hoi"], SearchNormalizer.Terms("Sushi cá HỒI sushi"));
            Assert.Equal(6, SearchNormalizer.Terms("a b c d e f g h").Count);
        }
    }

    public class ProductSearchTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly long[] _ids;

        public ProductSearchTests()
        {
            _ids = _db.SeedProducts(
                ("Cá hồi nướng Teriyaki", 199_000, null, 10),
                ("Nigiri cá hồi", 59_000, null, 10),
                ("Bánh cá Taiyaki", 35_000, null, 10),
                ("Sashimi Otoro", 890_000, null, 10));

            using var ctx = _db.NewContext();
            ctx.ProductTranslations.Add(new ProductTranslationEntities { ProductId = _ids[3], LanguageCode = "ja", Name = "大トロ刺身" });
            ctx.ProductTranslations.Add(new ProductTranslationEntities { ProductId = _ids[1], LanguageCode = "en", Name = "Salmon Nigiri" });
            ctx.SaveChanges();
            new SearchIndexer(ctx).RebuildAsync().GetAwaiter().GetResult();
        }

        public void Dispose() => _db.Dispose();

        private async Task<List<string>> Search(string q, string lang = "vi")
        {
            using var ctx = _db.NewContext();
            var result = await new ProductService(ctx).SearchAsync(new ProductQuery { Search = q }, lang);
            return result.Items.Select(i => i.Name).ToList();
        }

        [Fact]
        public async Task Finds_without_accents()
            => Assert.Equal(2, (await Search("ca hoi")).Count);

        [Fact]
        public async Task Ranks_name_start_above_mid_name_match()
            => Assert.Equal("Cá hồi nướng Teriyaki", (await Search("ca hoi"))[0]);

        [Fact]
        public async Task Finds_by_translated_names_in_any_language()
        {
            Assert.Equal(["大トロ刺身"], await Search("大トロ", "ja"));
            Assert.Equal(["Sashimi Otoro"], await Search("大トロ", "vi"));
            Assert.Equal(["Nigiri cá hồi"], await Search("salmon"));
        }

        [Fact]
        public async Task Every_term_must_match()
        {
            Assert.Equal(["Cá hồi nướng Teriyaki"], await Search("teriyaki hoi"));
            Assert.Empty(await Search("teriyaki otoro"));
        }

        [Fact]
        public async Task Category_names_are_searchable()
            => Assert.Equal(4, (await Search("nigiri")).Count); // every seeded product sits in the "Nigiri" category
    }
}
