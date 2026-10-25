using JapaneseFood.Entity.Article;
using JapaneseFood.Entity.Banner;
using JapaneseFood.Entity.Category;
using JapaneseFood.Entity.Coupon;
using JapaneseFood.Entity.Discount;
using JapaneseFood.Entity.Image;
using JapaneseFood.Entity.Language;
using JapaneseFood.Entity.Order;
using JapaneseFood.Entity.Product;
using JapaneseFood.Entity.Store;
using JapaneseFood.Entity.User;

using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using System.Text;
using System.Threading.Tasks;

namespace JapaneseFood.Entity
{
    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options)
       : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var typesToRegister = Assembly.GetExecutingAssembly().GetTypes()
                                    .Where(t => t.GetInterfaces()
                                    .Any(gi => gi.IsGenericType
                                    && gi.GetGenericTypeDefinition() == typeof(IEntityTypeConfiguration<>))).ToList();

            foreach (var type in typesToRegister)
            {
                var configurationInstance = Activator.CreateInstance(type);
                if (configurationInstance != null)
                {
                    modelBuilder.ApplyConfiguration((dynamic)configurationInstance);
                }
            }
            modelBuilder.Entity<UserEntities>()
                .HasData(
                   new UserEntities
                   {
                       CreatedAt = new DateTime(2024, 01, 01),
                       FullName = "admin",
                       Id = 1,
                       // ASP.NET Identity V3 (PBKDF2-HMACSHA512) hash of the default password "123".
                       // Change it from the admin UI after first login.
                       Password = "AQAAAAIAAYagAAAAEPO5+ni6npNN02OxSecDOLy7LPPdxlcAdanBZ1alwSrE63VgumDy2Y9+DPENqkAYqQ==",
                       PhoneNumber = "098765432",
                       UserName = "admin@gmail.com",
                       RoleId = 2,
                       IsActive = true
                   }
            );
            modelBuilder.Entity<ProductEntities>()
                .HasMany(p => p.Images)
                .WithOne(i => i.Product)
                .HasForeignKey(i => i.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
        public virtual DbSet<CategoryEntities> Categorys { get; set; }
        public virtual DbSet<BannerEntities> Banners { get; set; }
        public virtual DbSet<CatalogEntities> Catalogs { get; set; }
        public virtual DbSet<UserEntities> Users { get; set; }
        public virtual DbSet<ProductEntities> Products { get; set; }
        public virtual DbSet<ProductLikeEntities> ProductLikes { get; set; }
        public virtual DbSet<ProductViewEntities> ProductViews { get; set; }
        public virtual DbSet<ImageEntities> Images { get; set; }
        public virtual DbSet<OrderEntities> Orders { get; set; }
        public virtual DbSet<OrderDetailEntities> OrderDetails { get; set; }
        public virtual DbSet<DiscountEntities> Discounts { get; set; }

        public virtual DbSet<LanguageEntities> Language { get; set; }

        public virtual DbSet<OrderStatusHistoryEntities> OrderStatusHistory { get; set; }
        public virtual DbSet<ProductTranslationEntities> ProductTranslations { get; set; }
        public virtual DbSet<CategoryTranslationEntities> CategoryTranslations { get; set; }
        public virtual DbSet<CatalogTranslationEntities> CatalogTranslations { get; set; }
        public virtual DbSet<ReviewEntities> Reviews { get; set; }
        public virtual DbSet<WishlistEntities> Wishlists { get; set; }
        public virtual DbSet<CouponEntities> Coupons { get; set; }
        public virtual DbSet<UserAddressEntities> UserAddresses { get; set; }
        public virtual DbSet<RefreshTokenEntities> RefreshTokens { get; set; }
        public virtual DbSet<StorePolicyEntities> StorePolicies { get; set; }
        public virtual DbSet<StorePolicyTranslationEntities> StorePolicyTranslations { get; set; }
        public virtual DbSet<StoreSettingEntities> StoreSettings { get; set; }

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            // Money columns: matches the existing decimal(18,2) columns and silences EF precision warnings
            configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        }
    }
}

