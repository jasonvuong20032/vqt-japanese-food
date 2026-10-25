using JapaneseFood.Entity;
using JapaneseFood.Entity.Article;
using JapaneseFood.Entity.Category;
using JapaneseFood.Entity.Product;
using JapaneseFood.Service.Email;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace JapaneseFood.Tests
{
    /// <summary>Real relational database (SQLite in memory) so transactions, ExecuteUpdate and constraints behave.</summary>
    public sealed class TestDb : IDisposable
    {
        private readonly SqliteConnection _connection;

        public TestDb()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();
            using var ctx = NewContext();
            ctx.Database.EnsureCreated();
        }

        public DataContext NewContext()
            => new(new DbContextOptionsBuilder<DataContext>().UseSqlite(_connection).Options);

        /// <summary>One catalog → one category → products with the given (price, salePrice, stock).</summary>
        public long[] SeedProducts(params (string Name, decimal Price, decimal? SalePrice, int Stock)[] products)
        {
            using var ctx = NewContext();
            var catalog = new CatalogEntities { Name = "Sushi", IsActive = true, CreatedAt = TestClock.Now };
            ctx.Catalogs.Add(catalog);
            ctx.SaveChanges();
            var category = new CategoryEntities { Name = "Nigiri", CatalogId = catalog.Id, IsActive = true, CreatedAt = TestClock.Now };
            ctx.Categorys.Add(category);
            ctx.SaveChanges();

            var entities = products.Select((p, i) => new ProductEntities
            {
                Name = p.Name,
                Code = $"P{i:000}",
                Slug = $"product-{i}",
                CategoryId = category.Id,
                Price = p.Price,
                SalePrice = p.SalePrice,
                IsOnSale = p.SalePrice.HasValue,
                Quantity = p.Stock,
                IsAvailable = true,
                IsActive = true,
                CreatedAt = TestClock.Now.AddMinutes(i),
            }).ToList();
            ctx.Products.AddRange(entities);
            ctx.SaveChanges();
            return entities.Select(e => e.Id).ToArray();
        }

        public void Dispose() => _connection.Dispose();
    }

    public sealed class TestClock : TimeProvider
    {
        public static readonly DateTime Now = new(2026, 10, 4, 12, 0, 0);
        public DateTimeOffset Current { get; set; } = new(Now, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Current;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }

    public sealed class FakeEmailQueue : IEmailQueue
    {
        public List<EmailMessage> Sent { get; } = [];
        public void Enqueue(EmailMessage message) => Sent.Add(message);
    }
}
