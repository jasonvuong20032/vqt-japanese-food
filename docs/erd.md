# Entity–relationship diagrams (ERD)

The `vqt_japanese_food` database (SQL Server) has **24 tables**. The diagrams below are generated from the EF Core model
(`JapaneseFood.Entity/Migrations/DataContextModelSnapshot.cs`), so they match the database after the latest migration.

PNG exports of every diagram are in [`docs/diagrams/`](diagrams/) (for reports and slides).

## How to read the diagrams

| Notation | Meaning |
|---|---|
| Solid line `||--o{` | A real foreign key in the database (**FK**), enforced by a constraint. There are 9 of these. |
| Dotted line `..` | A **logical** reference: the column holds another table's id or code, but the database has no FK constraint; the application enforces it. There are 12 of these. |
| `||` / `|o` on the left end | Required / optional (for example guest orders have `UserId = 0`) |
| `o{` on the right end | Zero or more |
| `PK`, `FK`, `UK` | Primary key, foreign key, unique value (unique index) |

To keep the diagrams readable, the audit columns that most tables inherit from `BaseEntities` are **not drawn**:
`CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`, `IsActive` (in use) and `IsDelete` (soft delete).

## Overview

```mermaid
erDiagram
    Catalogs ||--o{ CatalogTranslations : "CatalogId (FK)"
    Catalogs ||--o{ Categorys : "CatalogId (FK)"
    Categorys ||--o{ CategoryTranslations : "CategoryId (FK)"
    Products ||--o{ Images : "ProductId (FK)"
    Orders ||--o{ OrderDetail : "OrderId (FK)"
    Orders ||--o{ OrderStatusHistory : "OrderId (FK)"
    Categorys ||--o{ Products : "CategoryId (FK)"
    Products ||--o{ ProductTranslations : "ProductId (FK)"
    StorePolicies ||--o{ StorePolicyTranslations : "StorePolicyId (FK)"
    Products ||..o{ OrderDetail : "ProductId"
    Users |o..o{ Orders : "UserId"
    Products ||..o{ ProductLikes : "ProductId"
    Products ||..o{ ProductViews : "ProductId"
    Products ||..o{ Reviews : "ProductId"
    Users ||..o{ Reviews : "UserId"
    Products ||..o{ Wishlists : "ProductId"
    Users ||..o{ Wishlists : "UserId"
    Users ||..o{ RefreshTokens : "UserId"
    Users ||..o{ UserAddresses : "UserId"
    Coupons |o..o{ Orders : "CouponCode"
    Discounts |o..o{ Products : "DiscountId"
    Banners
    CatalogTranslations
    Catalogs
    CategoryTranslations
    Categorys
    Coupons
    Discounts
    Images
    Language
    OrderDetail
    OrderStatusHistory
    Orders
    ProductLikes
    ProductTranslations
    ProductViews
    Products
    RefreshTokens
    Reviews
    StorePolicies
    StorePolicyTranslations
    StoreSettings
    UserAddresses
    Users
    Wishlists
```

## 1. Menu (sections, categories, dishes, translations)

The menu has two levels: a **section** (`Catalogs`, for example "Sushi & Sashimi") contains **categories** (`Categorys`, for example "Nigiri"), and a category contains **dishes** (`Products`).
Each level has a `*Translations` table for English, Japanese, Korean and French; the base columns hold the Vietnamese text, which is also the fallback when a translation is missing.
`SearchName`/`SearchText` are the accent-free search index, combining names, descriptions, tags and category names in every language.

```mermaid
erDiagram
    Catalogs ||--o{ CatalogTranslations : "CatalogId (FK)"
    Catalogs ||--o{ Categorys : "CatalogId (FK)"
    Categorys ||--o{ CategoryTranslations : "CategoryId (FK)"
    Products ||--o{ Images : "ProductId (FK)"
    Categorys ||--o{ Products : "CategoryId (FK)"
    Products ||--o{ ProductTranslations : "ProductId (FK)"
    Catalogs {
        bigint Id PK
        nvarchar(500) CoverImageUrl "nullable"
        nvarchar(1000) Description "nullable"
        nvarchar Name
        nvarchar(120) Slug UK "nullable"
        int SortOrder
    }
    CatalogTranslations {
        bigint Id PK
        bigint CatalogId FK
        nvarchar(1000) Description "nullable"
        nvarchar(10) LanguageCode
        nvarchar(300) Name
    }
    Categorys {
        bigint Id PK
        bigint CatalogId FK
        nvarchar(1000) Description "nullable"
        nvarchar Name
        int SortOrder
    }
    CategoryTranslations {
        bigint Id PK
        bigint CategoryId FK
        nvarchar(1000) Description "nullable"
        nvarchar(10) LanguageCode
        nvarchar(300) Name
    }
    Products {
        bigint Id PK
        nvarchar Address "nullable"
        bigint CategoryId FK
        nvarchar(50) Code UK
        nvarchar Description "nullable"
        int DiscountId "nullable"
        bit IsAvailable
        bit IsOnSale
        float Latitude
        float Longitude
        nvarchar(500) MetaDescription "nullable"
        nvarchar(200) MetaTitle "nullable"
        nvarchar Name
        decimal Price
        int Quantity
        int Rating
        int ReviewCount
        decimal SalePrice "nullable"
        nvarchar(1000) SearchName "nullable"
        nvarchar(4000) SearchText "nullable"
        nvarchar ShortDescription "nullable"
        nvarchar(200) Slug UK "nullable"
        int SoldCount
        nvarchar(500) Tags "nullable"
    }
    ProductTranslations {
        bigint Id PK
        nvarchar Description "nullable"
        nvarchar(10) LanguageCode
        nvarchar(300) Name
        bigint ProductId FK
        nvarchar ShortDescription "nullable"
    }
    Images {
        int Id PK
        nvarchar Alt
        nvarchar ImageUrl
        bigint ProductId FK
        int SortOrder
        nvarchar Title
    }
    Language {
        int Id PK
        nvarchar(10) Code
        nvarchar Name "nullable"
        nvarchar National "nullable"
        int SortOrder
    }
```

## 2. Orders and coupons

`OrderDetail` **snapshots** the dish name and unit price at the time of purchase (`ProductName`, `UnitPrice`, `LineTotal`), so later price changes never alter past orders.
Every status change is recorded in `OrderStatusHistory` (who, when, note).
`StockReserved` tells whether the order is holding stock; cancelling the order returns the stock and the coupon use.

```mermaid
erDiagram
    Orders ||--o{ OrderDetail : "OrderId (FK)"
    Orders ||--o{ OrderStatusHistory : "OrderId (FK)"
    Products ||..o{ OrderDetail : "ProductId"
    Users |o..o{ Orders : "UserId"
    Coupons |o..o{ Orders : "CouponCode"
    Orders {
        bigint Id PK
        nvarchar Address "nullable"
        nvarchar(50) Code UK "public order code, e.g. JF261025AB2CD"
        nvarchar(50) CouponCode "nullable, matches Coupons.Code"
        decimal Discount
        nvarchar District "nullable"
        nvarchar FullName "nullable"
        nvarchar(10) Language "nullable"
        nvarchar Note "nullable"
        datetime2 PaidAt "nullable"
        int PaymentMethod "0 COD (1 VnPay, 2 MoMo: reserved, unused)"
        int PaymentStatus "0 Unpaid, 1 Paid, 2 Failed, 3 Refunded"
        nvarchar(100) PaymentTransactionId "nullable"
        nvarchar Phone "nullable"
        nvarchar Province "nullable"
        int Quantity
        decimal ShippingFee
        int Status "0 Pending, 1 Confirmed, 2 Cancelled, 3 Preparing, 4 Shipping, 5 Delivered, 6 Refunded"
        bit StockReserved
        decimal SubTotal
        decimal TotalAmount
        bigint UserId "0 = guest order"
        nvarchar UserName "nullable"
        nvarchar Ward "nullable"
    }
    OrderDetail {
        bigint Id PK
        decimal LineTotal
        bigint OrderId FK
        bigint ProductId
        nvarchar ProductName "nullable"
        int Quantity
        decimal UnitPrice
    }
    OrderStatusHistory {
        bigint Id PK
        datetime2 ChangedAt
        nvarchar ChangedBy "nullable"
        int FromStatus
        nvarchar Note "nullable"
        bigint OrderId FK
        int ToStatus
    }
    Coupons {
        bigint Id PK
        nvarchar(50) Code UK
        nvarchar Description "nullable"
        datetime2 ExpiresAt "nullable"
        decimal MaxDiscountAmount "nullable"
        decimal MinOrderAmount
        datetime2 StartsAt "nullable"
        int Type "1 percentage, 2 fixed amount"
        int UsageLimit "nullable"
        int UsedCount
        decimal Value
    }
    Products
    Users
```

## 3. Customers and accounts

`Users.UserName` is the sign-in email. Passwords are hashed (ASP.NET Core `PasswordHasher`); `RefreshTokens` only stores a **hash** of each token,
and `ReplacedByHash` is used to detect a token being reused.

```mermaid
erDiagram
    Products ||..o{ ProductViews : "ProductId"
    Products ||..o{ Reviews : "ProductId"
    Users ||..o{ Reviews : "UserId"
    Products ||..o{ Wishlists : "ProductId"
    Users ||..o{ Wishlists : "UserId"
    Users ||..o{ RefreshTokens : "UserId"
    Users ||..o{ UserAddresses : "UserId"
    Users {
        bigint Id PK
        nvarchar ActivationCode "nullable"
        datetime2 ActivationCodeExpiresAt "nullable"
        nvarchar Address "nullable"
        nvarchar Avatar "nullable"
        datetime2 BirthDate
        nvarchar FullName
        int Gender
        bit IsLocked
        nvarchar Password
        nvarchar(64) PasswordResetCode "nullable"
        datetime2 PasswordResetExpiresAt "nullable"
        nvarchar PhoneNumber
        nvarchar(10) PreferredLanguage "nullable"
        nvarchar(20) PreferredTheme "nullable"
        int RoleId "1 Customer, 2 Admin, 3 Staff"
        nvarchar(256) UserName UK
    }
    UserAddresses {
        bigint Id PK
        nvarchar District "nullable"
        nvarchar FullName
        bit IsDefault
        nvarchar Phone
        nvarchar Province "nullable"
        nvarchar Street
        bigint UserId
        nvarchar Ward "nullable"
    }
    RefreshTokens {
        bigint Id PK
        datetime2 ExpiresAt
        nvarchar(64) ReplacedByHash "nullable"
        datetime2 RevokedAt "nullable"
        nvarchar(64) TokenHash UK
        bigint UserId
    }
    Wishlists {
        bigint Id PK
        bigint ProductId
        bigint UserId
    }
    Reviews {
        bigint Id PK
        nvarchar(2000) Comment "nullable"
        bit IsApproved
        bigint ProductId
        int Rating
        bigint UserId
    }
    ProductViews {
        bigint Id PK
        bigint ProductId
        int View
    }
    Products
```

## 4. Store content and legacy tables

`StoreSettings` is a key–value table: store details, delivery fee, free-delivery threshold, website address, and the "Our story" page content (JSON per language).

```mermaid
erDiagram
    StorePolicies ||--o{ StorePolicyTranslations : "StorePolicyId (FK)"
    Products ||..o{ ProductLikes : "ProductId"
    Discounts |o..o{ Products : "DiscountId"
    StorePolicies {
        bigint Id PK
        nvarchar Content
        int SortOrder
        nvarchar Title
        nvarchar(50) Topic
    }
    StorePolicyTranslations {
        bigint Id PK
        nvarchar Content
        nvarchar(10) LanguageCode
        bigint StorePolicyId FK
        nvarchar Title
    }
    StoreSettings {
        int Id PK
        nvarchar(100) Key UK
        nvarchar Value "nullable"
    }
    Banners {
        bigint Id PK
        nvarchar ImageUrl "nullable"
        nvarchar Title
    }
    Discounts {
        bigint Id PK
        nvarchar Name
        int Type
        decimal Value
    }
    ProductLikes {
        bigint Id PK
        int Like
        bigint ProductId
    }
    Products
```

## Multi-column unique constraints

| Table | Columns | Meaning |
|---|---|---|
| `CatalogTranslations` | `CatalogId`, `LanguageCode` | At most one translation per section per language |
| `CategoryTranslations` | `CategoryId`, `LanguageCode` | At most one translation per category per language |
| `ProductTranslations` | `ProductId`, `LanguageCode` | At most one translation per dish per language |
| `Reviews` | `ProductId`, `UserId` | A customer can review a dish only once |
| `Wishlists` | `UserId`, `ProductId` | A dish appears in a customer's favourites only once |
| `StorePolicyTranslations` | `StorePolicyId`, `LanguageCode` | At most one translation per policy entry per language |

## Table list

| Table | Purpose | Status |
|---|---|---|
| `Catalogs`, `CatalogTranslations` | Menu sections and their translations | In use |
| `Categorys`, `CategoryTranslations` | Categories and their translations (the `Categorys` name is kept from the old system) | In use |
| `Products`, `ProductTranslations` | Dishes: price, stock, SEO, search index, and their translations | In use |
| `Images` | Dish photos; the photo with the lowest `SortOrder` is the cover | In use |
| `Language` | The 5 supported languages, created automatically at startup | In use |
| `Orders`, `OrderDetail` | Orders and their dish lines | In use |
| `OrderStatusHistory` | Status history of each order | In use |
| `Coupons` | Discount codes (percentage or fixed amount, usage limit, validity period) | In use |
| `Users` | Customer, staff and administrator accounts (told apart by `RoleId`) | In use |
| `UserAddresses` | Address book, up to 10 addresses per customer | In use |
| `RefreshTokens` | Sign-in sessions (hashed refresh tokens) | In use |
| `Wishlists` | Favourite dishes | In use |
| `Reviews` | Reviews by customers who bought the dish | In use |
| `ProductViews` | Dish view counter, used for ranking when there is not enough sales data | In use |
| `StorePolicies`, `StorePolicyTranslations` | Policies & FAQ entries and their translations | In use |
| `StoreSettings` | Store settings as key–value pairs | In use |
| `Discounts` | Discount campaigns of the legacy MVC site | Legacy site only |
| `Banners` | Banners of the legacy MVC site | No longer used |
| `ProductLikes` | Likes of the legacy MVC site (replaced by `Wishlists`) | No longer used |
