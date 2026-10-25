using JapaneseFood.Entity.Article;
using JapaneseFood.Entity.Category;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Entity.Language;
using JapaneseFood.Entity.Order;
using JapaneseFood.Entity.Product;
using JapaneseFood.Entity.Store;
using JapaneseFood.Entity.User;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

// Picked up automatically by DataContext.OnModelCreating (scans IEntityTypeConfiguration<>).
namespace JapaneseFood.Entity.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<UserEntities>
    {
        public void Configure(EntityTypeBuilder<UserEntities> b)
        {
            b.Property(x => x.UserName).HasMaxLength(256);
            b.HasIndex(x => x.UserName).IsUnique();
            b.Property(x => x.PreferredLanguage).HasMaxLength(10);
            b.Property(x => x.PreferredTheme).HasMaxLength(20);
            b.Property(x => x.PasswordResetCode).HasMaxLength(64);
        }
    }

    public class ProductConfiguration : IEntityTypeConfiguration<ProductEntities>
    {
        public void Configure(EntityTypeBuilder<ProductEntities> b)
        {
            b.Property(x => x.Code).HasMaxLength(50);
            b.HasIndex(x => x.Code).IsUnique();
            b.Property(x => x.Slug).HasMaxLength(200);
            b.HasIndex(x => x.Slug).IsUnique().HasFilter("[Slug] IS NOT NULL");
            b.Property(x => x.Tags).HasMaxLength(500);
            b.Property(x => x.MetaTitle).HasMaxLength(200);
            b.Property(x => x.MetaDescription).HasMaxLength(500);
            // Storefront listing: active products by category, newest / best-selling first
            b.HasIndex(x => new { x.IsDelete, x.IsActive, x.CategoryId });
            b.HasIndex(x => x.CreatedAt);
            b.HasIndex(x => x.SoldCount);
            b.Property(x => x.SearchName).HasMaxLength(1000);
            b.Property(x => x.SearchText).HasMaxLength(4000);
        }
    }

    public class CatalogConfiguration : IEntityTypeConfiguration<CatalogEntities>
    {
        public void Configure(EntityTypeBuilder<CatalogEntities> b)
        {
            b.Property(x => x.Slug).HasMaxLength(120);
            b.HasIndex(x => x.Slug).IsUnique().HasFilter("[Slug] IS NOT NULL");
            b.Property(x => x.Description).HasMaxLength(1000);
            b.Property(x => x.CoverImageUrl).HasMaxLength(500);
        }
    }

    public class CategoryConfiguration : IEntityTypeConfiguration<CategoryEntities>
    {
        public void Configure(EntityTypeBuilder<CategoryEntities> b)
        {
            b.Property(x => x.Description).HasMaxLength(1000);
        }
    }

    public class ProductTranslationConfiguration : IEntityTypeConfiguration<ProductTranslationEntities>
    {
        public void Configure(EntityTypeBuilder<ProductTranslationEntities> b)
        {
            b.Property(x => x.LanguageCode).HasMaxLength(10);
            b.Property(x => x.Name).HasMaxLength(300);
            b.HasIndex(x => new { x.ProductId, x.LanguageCode }).IsUnique();
            b.HasOne(x => x.Product)
                .WithMany(p => p.Translations)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class CategoryTranslationConfiguration : IEntityTypeConfiguration<CategoryTranslationEntities>
    {
        public void Configure(EntityTypeBuilder<CategoryTranslationEntities> b)
        {
            b.Property(x => x.LanguageCode).HasMaxLength(10);
            b.Property(x => x.Name).HasMaxLength(300);
            b.Property(x => x.Description).HasMaxLength(1000);
            b.HasIndex(x => new { x.CategoryId, x.LanguageCode }).IsUnique();
            b.HasOne<CategoryEntities>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class CatalogTranslationConfiguration : IEntityTypeConfiguration<CatalogTranslationEntities>
    {
        public void Configure(EntityTypeBuilder<CatalogTranslationEntities> b)
        {
            b.Property(x => x.LanguageCode).HasMaxLength(10);
            b.Property(x => x.Name).HasMaxLength(300);
            b.Property(x => x.Description).HasMaxLength(1000);
            b.HasIndex(x => new { x.CatalogId, x.LanguageCode }).IsUnique();
            b.HasOne<CatalogEntities>().WithMany().HasForeignKey(x => x.CatalogId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class OrderConfiguration : IEntityTypeConfiguration<OrderEntities>
    {
        public void Configure(EntityTypeBuilder<OrderEntities> b)
        {
            b.Property(x => x.Code).HasMaxLength(50);
            b.HasIndex(x => x.Code).IsUnique();
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => new { x.Status, x.CreatedAt });
            b.Property(x => x.CouponCode).HasMaxLength(50);
            b.Property(x => x.PaymentTransactionId).HasMaxLength(100);
            b.Property(x => x.Language).HasMaxLength(10);
            b.HasMany(x => x.Details)
                .WithOne()
                .HasForeignKey(d => d.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class OrderDetailConfiguration : IEntityTypeConfiguration<OrderDetailEntities>
    {
        public void Configure(EntityTypeBuilder<OrderDetailEntities> b)
        {
            b.HasIndex(x => x.ProductId);
        }
    }

    public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistoryEntities>
    {
        public void Configure(EntityTypeBuilder<OrderStatusHistoryEntities> b)
        {
            b.HasIndex(x => x.OrderId);
            b.HasOne<OrderEntities>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ReviewConfiguration : IEntityTypeConfiguration<ReviewEntities>
    {
        public void Configure(EntityTypeBuilder<ReviewEntities> b)
        {
            b.Property(x => x.Comment).HasMaxLength(2000);
            b.HasIndex(x => new { x.ProductId, x.IsApproved });
            b.HasIndex(x => new { x.ProductId, x.UserId }).IsUnique();
        }
    }

    public class WishlistConfiguration : IEntityTypeConfiguration<WishlistEntities>
    {
        public void Configure(EntityTypeBuilder<WishlistEntities> b)
        {
            b.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
        }
    }

    public class CouponConfiguration : IEntityTypeConfiguration<CouponEntities>
    {
        public void Configure(EntityTypeBuilder<CouponEntities> b)
        {
            b.Property(x => x.Code).HasMaxLength(50);
            b.HasIndex(x => x.Code).IsUnique();
        }
    }

    public class UserAddressConfiguration : IEntityTypeConfiguration<UserAddressEntities>
    {
        public void Configure(EntityTypeBuilder<UserAddressEntities> b)
        {
            b.HasIndex(x => x.UserId);
        }
    }

    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshTokenEntities>
    {
        public void Configure(EntityTypeBuilder<RefreshTokenEntities> b)
        {
            b.Property(x => x.TokenHash).HasMaxLength(64);
            b.Property(x => x.ReplacedByHash).HasMaxLength(64);
            b.HasIndex(x => x.TokenHash).IsUnique();
            b.HasIndex(x => x.UserId);
        }
    }

    public class StorePolicyConfiguration : IEntityTypeConfiguration<StorePolicyEntities>
    {
        public void Configure(EntityTypeBuilder<StorePolicyEntities> b)
        {
            b.Property(x => x.Topic).HasMaxLength(50);
            b.HasIndex(x => x.Topic);
            b.HasMany(x => x.Translations)
                .WithOne()
                .HasForeignKey(t => t.StorePolicyId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class StorePolicyTranslationConfiguration : IEntityTypeConfiguration<StorePolicyTranslationEntities>
    {
        public void Configure(EntityTypeBuilder<StorePolicyTranslationEntities> b)
        {
            b.Property(x => x.LanguageCode).HasMaxLength(10);
            b.HasIndex(x => new { x.StorePolicyId, x.LanguageCode }).IsUnique();
        }
    }

    public class StoreSettingConfiguration : IEntityTypeConfiguration<StoreSettingEntities>
    {
        public void Configure(EntityTypeBuilder<StoreSettingEntities> b)
        {
            b.Property(x => x.Key).HasMaxLength(100);
            b.HasIndex(x => x.Key).IsUnique();
        }
    }

    public class LanguageConfiguration : IEntityTypeConfiguration<LanguageEntities>
    {
        public void Configure(EntityTypeBuilder<LanguageEntities> b)
        {
            b.Property(x => x.Code).HasMaxLength(10);
            b.HasIndex(x => x.Code);
        }
    }
}
