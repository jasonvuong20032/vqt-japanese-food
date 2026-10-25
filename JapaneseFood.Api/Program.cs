using JapaneseFood.Api.Auth;
using JapaneseFood.Service.Auth;
using JapaneseFood.Api.Infrastructure;
using JapaneseFood.Common.Helper;
using JapaneseFood.Entity;
using JapaneseFood.Model;
using JapaneseFood.Service;
using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Setup;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------------------------------------------------------------- data + business services
builder.Services.AddDbContextPool<DataContext>(options =>
    options.UseSqlServer(
        config.GetConnectionString("VQTConnections"),
        sql => sql.MigrationsAssembly("JapaneseFood.Entity")
            .EnableRetryOnFailure(3)
            // Collections are loaded in separate queries instead of one wide join (no row explosion)
            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)),
    poolSize: 128);

builder.Services.Configure<SmtpSettings>(config.GetSection("SmtpSettings"));
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddJapaneseFoodServices();
builder.Services.AddJapaneseFoodAdminServices();
builder.Services.AddJapaneseFoodAi(config);

var storage = config.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();
var uploadsRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, storage.UploadsPath));
Directory.CreateDirectory(uploadsRoot);
builder.Services.AddSingleton(storage);
builder.Services.AddSingleton<IImageStorage>(sp => new DiskImageStorage(uploadsRoot, sp.GetRequiredService<ILogger<DiskImageStorage>>()));

// ---------------------------------------------------------------- auth (JWT in HttpOnly cookie)
var jwt = config.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key must be at least 32 characters. Set it with: dotnet user-secrets set \"Jwt:Key\" \"<random 64 chars>\" --project JapaneseFood.Api");
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.SigningKey(),
            NameClaimType = "name",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            // Browser sends the token as a cookie; tools (curl, tests) may still use the Authorization header
            OnMessageReceived = ctx =>
            {
                if (string.IsNullOrEmpty(ctx.Token)) ctx.Token = ctx.Request.Cookies[AuthCookies.Access];
                return Task.CompletedTask;
            },
            // Back-office requests re-check the live role and lock state: a 15-minute token must not outlive
            // a demotion or a locked account. A failed check is a 401, so the SPA refreshes and gets the new role.
            OnTokenValidated = async ctx =>
            {
                if (!ctx.Request.Path.StartsWithSegments("/api/admin")) return;
                if (ctx.Principal?.GetUserId() is not long userId)
                {
                    ctx.Fail("No user id in token.");
                    return;
                }
                var access = await ctx.HttpContext.RequestServices.GetRequiredService<IUserAccessCache>()
                    .GetAsync(userId, ctx.HttpContext.RequestAborted);
                if (!access.CanSignIn || access.Role != ctx.Principal.FindFirst("role")?.Value)
                    ctx.Fail("Account access has changed.");
            },
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Staff", p => p.RequireRole("Admin", "Staff"))
    .AddPolicy("Admin", p => p.RequireRole("Admin"));

// ---------------------------------------------------------------- performance: caching, compression, rate limits
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy(PublicCachePolicy.Name, new PublicCachePolicy());
    options.SizeLimit = 256 * 1024 * 1024;
});

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

static string ClientIp(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, ct) =>
    {
        var problem = new ProblemDetails { Status = 429, Title = "Too many requests. Please wait a moment." };
        problem.Extensions["code"] = "rate_limited";
        await ctx.HttpContext.Response.WriteAsJsonAsync(problem, ct);
    };

    // Generous per-IP ceiling for everything (stops scrapers / runaway clients)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ClientIp(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 600, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
        }));

    // Login / register / reset / order tracking: slows down password guessing and code brute-forcing
    options.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientIp(ctx), _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
    }));

    options.AddPolicy("checkout", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientIp(ctx), _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
    }));

    // Every AI translation is a paid model call: short bursts are fine, sustained use is throttled to 3 a minute
    options.AddPolicy("ai", ctx => RateLimitPartition.GetTokenBucketLimiter(ClientIp(ctx), _ => new TokenBucketRateLimiterOptions
    {
        TokenLimit = 8, TokensPerPeriod = 3, ReplenishmentPeriod = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true,
    }));
});

// ---------------------------------------------------------------- MVC / errors / docs
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = ctx =>
        {
            var problem = new ValidationProblemDetails(ctx.ModelState) { Status = 400, Title = "Please check the highlighted fields." };
            problem.Extensions["code"] = "validation_failed";
            return new BadRequestObjectResult(problem);
        };
    });
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var corsOrigins = config.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

// ---------------------------------------------------------------- startup data
using (var scope = app.Services.CreateScope())
{
    try
    {
        await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync(includeDemoData: app.Environment.IsDevelopment());

        // One-off: dotnet run --project JapaneseFood.Api -- --seed-menu ../seed
        var seedIndex = Array.IndexOf(args, "--seed-menu");
        if (seedIndex >= 0)
        {
            var dir = Path.GetFullPath(args.ElementAtOrDefault(seedIndex + 1) ?? Path.Combine(app.Environment.ContentRootPath, "..", "seed"));
            var report = await scope.ServiceProvider.GetRequiredService<MenuSeeder>().SeedAsync(dir);
            Console.WriteLine($"Menu seeded from {dir}: {report}");
            return;
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex,
            "Database is not ready. Apply migrations first: dotnet ef database update --project JapaneseFood.Entity --startup-project JapaneseFood.Api");
        throw;
    }
}

// ---------------------------------------------------------------- pipeline
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (ctx, next) =>
{
    var headers = ctx.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next();
});

app.UseResponseCompression();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/Uploads",
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=604800",
});

// Production: the built React app is copied into wwwroot and served from the same origin as the API
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseOutputCache();

if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapHealthChecks("/health");
app.MapControllers();
app.MapFallback("/api/{**path}", () => Results.Problem(statusCode: 404, title: "Not found"));
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>Exposed for WebApplicationFactory-based integration tests.</summary>
public partial class Program;
