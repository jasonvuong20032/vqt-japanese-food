using JapaneseFood.Service.Account;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Ai;
using JapaneseFood.Service.Auth;
using JapaneseFood.Service.Catalogs;
using JapaneseFood.Service.Content;
using JapaneseFood.Service.Coupons;
using JapaneseFood.Service.Email;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Policies;
using JapaneseFood.Service.Products;
using JapaneseFood.Service.Recommendations;
using JapaneseFood.Service.Reviews;
using JapaneseFood.Service.Search;
using JapaneseFood.Service.Settings;
using JapaneseFood.Service.Setup;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace JapaneseFood.Service
{
    public static class ServiceCollectionExtensions
    {
        /// <summary>
        /// Registers the business services shared by the API and the legacy MVC site.
        /// Expects DataContext and IEmailSender to be registered by the host.
        /// </summary>
        public static IServiceCollection AddJapaneseFoodServices(this IServiceCollection services)
        {
            services.AddMemoryCache();
            services.TryAddSingleton(TimeProvider.System);

            services.AddSingleton<EmailQueue>();
            services.AddSingleton<IEmailQueue>(sp => sp.GetRequiredService<EmailQueue>());
            services.AddHostedService<EmailBackgroundSender>();

            services.AddSingleton<IPasswordService, PasswordService>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IRefreshTokenService, RefreshTokenService>();
            services.AddScoped<IAccountService, AccountService>();
            services.AddScoped<IUserAccessCache, UserAccessCache>();

            services.AddScoped<IProductService, ProductService>();
            services.AddScoped<ICatalogService, CatalogService>();
            services.AddScoped<IRecommendationService, RecommendationService>();
            services.AddScoped<IReviewService, ReviewService>();
            services.AddScoped<IStorePolicyService, StorePolicyService>();
            services.AddScoped<IStoreSettingsService, StoreSettingsService>();
            services.AddScoped<ICouponService, CouponService>();
            services.AddScoped<IOrderService, OrderService>();
            services.AddScoped<ISearchIndexer, SearchIndexer>();
            services.AddScoped<ISearchService, SearchService>();
            services.AddScoped<IStoreContentService, StoreContentService>();
            services.AddScoped<ICreditsService, CreditsService>();

            services.AddScoped<DataSeeder>();
            return services;
        }

        /// <summary>Back-office services. The host must also register an <see cref="IImageStorage"/>.</summary>
        public static IServiceCollection AddJapaneseFoodAdminServices(this IServiceCollection services)
        {
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<IAdminProductService, AdminProductService>();
            services.AddScoped<IAdminCatalogService, AdminCatalogService>();
            services.AddScoped<IAdminCustomerService, AdminCustomerService>();
            services.AddScoped<IAdminCouponService, AdminCouponService>();
            services.AddScoped<IAdminReviewService, AdminReviewService>();
            services.AddScoped<IAdminPolicyService, AdminPolicyService>();
            services.AddScoped<IAdminSettingsService, AdminSettingsService>();
            services.AddScoped<MenuSeeder>();
            return services;
        }

        /// <summary>
        /// Claude-powered features (API only): AI translation in the back office.
        /// Reads the "Ai" section for model settings and "Anthropic:ApiKey" (user-secrets) for the key;
        /// without a key these features report themselves unavailable.
        /// </summary>
        public static IServiceCollection AddJapaneseFoodAi(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<AiOptions>(configuration.GetSection(AiOptions.Section));
            services.AddSingleton<AnthropicClientProvider>();
            services.AddScoped<IAiTranslator, AiTranslator>();
            return services;
        }
    }
}
