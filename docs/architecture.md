# Architecture and code conventions

For developers continuing work on the project. Setup and run instructions are in the [README](../README.md).
Data model: [erd.md](erd.md) · Main flows: [sequence-diagrams.md](sequence-diagrams.md) · Functional spec: [use-cases.md](use-cases.md).

## Overview

```
Browser ── React SPA (frontend/) ──fetch──► JapaneseFood.Api ──► JapaneseFood.Service ──► JapaneseFood.Entity ──► SQL Server
                                                 │                        │
                                                 │                        ├─► Claude API (content translation, optional)
                                                 │                        └─► SMTP (through the email queue)
                                                 └─ serves wwwroot/ (the SPA build) + /Uploads
```

- **Api** only handles HTTP: routing, authentication, rate limiting, caching and reading the request language. Controllers contain no business logic.
- **Service** holds all business logic, one folder per feature: `Orders`, `Products`, `Search`, `Recommendations`, `Ai`, `Email`, `Admin`, `Auth`, `Account`, `Settings`…
- **Entity** holds `DataContext`, the entities and the migrations. **Common** holds shared enums (`EnumCommons`) and `EmailSender`.
- `vqt_japanese_food_web/` is the legacy MVC site: no new work goes there. The API still reads old images from `vqt_japanese_food_web/wwwroot/Uploads` (change with `Storage:UploadsPath`).

## Languages

- Request language: `?lang=` if present, otherwise the `Accept-Language` header, normalised to one of `vi, en, ja, ko, fr` (default `vi`). See `HttpContext.GetLanguage()`.
- Dynamic content (dishes, categories, sections, policies) has `*Translations` tables; when a translation is missing the Vietnamese text is returned.
- UI text lives in `frontend/src/i18n/locales/{lang}.json` (store) and `locales/admin/{lang}.json` (the `admin` namespace, only loaded inside `/admin`). The `locales.test.ts` test fails on a missing key or a `{{placeholder}}` that differs from Vietnamese, so **add every key to all five files**.
- Emails live in `Service/Email/EmailTemplates.cs`: one `Texts` set per language; unknown languages fall back to Vietnamese. Money is formatted per language (`145.000 ₫` for vi/fr, `₫145,000` for en/ja/ko).

## UI and themes

- Colours are CSS variables in `frontend/src/index.css`, one `[data-theme='…']` block per theme (light, dark, ocean, midnight). Components only use tokens (`bg-card`, `text-muted-foreground`, `--chart-1`…), never raw colour values.
- The three dark themes share Tailwind's `dark:` variant.
- Back-office charts are hand-drawn SVG (`admin/charts.tsx`); no chart library.

## Authentication and authorisation

- JWTs live in HttpOnly cookies: `jf_at` (access, 15 minutes) and `jf_rt` (refresh, only sent to `/api/auth`). `jf_si` is a non-secret cookie that only tells the SPA "probably signed in" without calling the API.
- Two policies: `Staff` (role Admin or Staff) and `Admin`. **`[Authorize]` attributes stack** (all must pass), so put the looser policy on the class and `Admin` on the individual actions that need it.
- On `/api/admin/*`, every request re-checks the role and lock state in the database (30-second cache, `IUserAccessCache`), so removing access takes effect without waiting for the token to expire.
- Refresh tokens rotate on every use and only their hash is stored. Reusing an old token (outside a 30-second grace period for parallel tabs) revokes every session of that account.
- Legacy plain-text passwords from the MVC site are accepted once and re-hashed immediately at sign-in.

## Orders

- The browser only sends `productId` and quantity. Prices, discounts, coupons and delivery fees are recalculated on the server (`OrderService`) inside one transaction that also decrements stock and increments `SoldCount`.
- Status changes follow the `OrderService.Transitions` table; cancelling restocks the items and gives the coupon use back. Every change is recorded in `OrderStatusHistory`.
- Emails are never sent inside a request: `IEmailQueue` queues them and `EmailBackgroundSender` sends them in the background, logging failures.

## Search and caching

- Every dish has precomputed `SearchName`/`SearchText` columns built from names, descriptions, tags and category names in **all languages**, with accents removed (`SearchNormalizer`). `SearchIndexer` rebuilds them whenever a dish or category changes.
- Public APIs (menu, dishes, policies) use the output cache with the `catalog` tag. Every back-office write calls `EvictByTagAsync(PublicCachePolicy.Tag)` so customers see changes immediately. Remember this line when adding a new write endpoint.
- Request coalescing is switched off in `PublicCachePolicy`: with it on, a client that disconnects mid-request would turn into a 500 for every request waiting on the same cache key.

## AI translation

- `AiTranslator` (the "Translate with AI" button in the back office) asks Claude for JSON that follows a fixed schema, then fills the form so staff can review it before saving. The model is set in `Ai:Model`; `POST /api/admin/translate` has the `ai` rate limit because every call costs money.
- Without `Anthropic:ApiKey` the feature switches itself off (`IsConfigured = false`) and everything else keeps working.

## Frontend

```
frontend/src/
  api/          API calls (client.ts), TanStack Query hooks and types
  pages/        store pages (lazy loaded per route)
  components/   ui/ (buttons, forms…), layout/, product/, cart/, order/
  admin/        the whole back office: a separate chunk that shoppers never download
  stores/       Zustand: cart (saved in localStorage), theme, language
  lib/          money/date formatting per language, error-code mapping
```

- Server data uses TanStack Query; client state (cart, theme) uses Zustand.
- Expected business failures throw `AppException` with a stable code; the API returns ProblemDetails with an extra `code` (plus `details` for per-field errors, code `validation_failed`). The frontend translates `code` through `errors.<code>` and field errors through `fieldErrors.<code>` (`lib/errors.ts`), so **a new backend error code needs a translation in all five languages**.

## Database changes

```bash
dotnet ef migrations add <MigrationName> --project JapaneseFood.Entity --startup-project JapaneseFood.Api
dotnet ef database update --project JapaneseFood.Entity --startup-project JapaneseFood.Api
```

The API does not apply migrations on startup. If the database has not been created or is missing tables, the startup data step fails and the API stops with "Database is not ready" and the command to run.

## Tests

- Backend: `JapaneseFood.Tests` runs on in-memory SQLite. Note that SQLite cannot `ORDER BY` a `decimal` column, so tests that sort by price behave differently from SQL Server. No test calls the real Claude API.
- Frontend: Vitest for formatting, the cart and translations.
