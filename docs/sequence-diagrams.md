# Sequence diagrams

The main flows of the system, drawn from the current code. Participant names are the real class and endpoint names so you can find them in the code.
PNG exports of every diagram are in [`docs/diagrams/`](diagrams/).

Common participants:

| Name in the diagrams | What it is |
|---|---|
| React SPA | The storefront and back office (`frontend/`); calls the API with `fetch`, cookies are sent automatically |
| `…Controller` | A controller in `JapaneseFood.Api` (reads identity and language, then calls a service) |
| `…Service` | Business logic in `JapaneseFood.Service` |
| SQL Server | The `vqt_japanese_food` database, accessed through EF Core |
| Email queue | `IEmailQueue` + `EmailBackgroundSender`: emails are sent in the background, requests never wait for SMTP |

## 1. Place an order (cash on delivery)

The browser only sends dish ids and quantities. Prices, discounts, delivery fee and total are always recalculated on the server.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant SPA as React SPA
    participant API as OrdersController
    participant OS as OrderService
    participant CS as CouponService
    participant DB as SQL Server
    participant EQ as Email queue

    C->>SPA: Open the checkout page
    SPA->>API: POST /api/cart/quote (items, couponCode)
    API->>OS: QuoteAsync
    OS->>DB: Read current prices and stock of the dishes
    opt A coupon code was entered
        OS->>CS: ApplyAsync(code, subtotal)
        CS-->>OS: Discount amount or a coupon_* error code
    end
    OS-->>SPA: Subtotal, discount, delivery fee, total, problems per line
    C->>SPA: Enter name, phone and address, click Place order
    SPA->>API: POST /api/orders (items, delivery details, couponCode, COD)
    Note over API: Rate limit "checkout" 10 per minute per IP
    API->>OS: PlaceOrderAsync(request, user taken from the cookie)
    OS->>OS: Validate the form (validation_failed with per-field errors)
    OS->>DB: Read prices and stock again
    alt A dish is no longer sold or stock is short
        OS-->>SPA: 409 product_unavailable or insufficient_stock
    else Valid
        OS->>CS: ApplyAsync (if a code was given)
        OS->>OS: Total = subtotal minus discount plus delivery fee (free above the threshold)
        critical One transaction
            loop Each dish in the cart
                OS->>DB: UPDATE Products SET Quantity -= n, SoldCount += n WHERE Quantity >= n
            end
            OS->>DB: If a coupon is used: UPDATE Coupons SET UsedCount += 1 WHERE uses remain
            OS->>DB: INSERT Orders, OrderDetail (name and price snapshot)
            OS->>DB: INSERT OrderStatusHistory (Pending)
        option Two customers buy the last item at the same moment
            OS-->>SPA: 409 insufficient_stock, everything rolled back
        end
        opt The customer gave an email
            OS->>EQ: "Order confirmation" email in the customer's language
        end
        OS-->>API: Order code (e.g. JF261025AB2CD), total
        API-->>SPA: 200
        SPA-->>C: Order success page, the cart is emptied
    end
```

## 2. Sign in and automatic session refresh

The access token lives 15 minutes; the refresh token 30 days ("Keep me signed in") or 24 hours. Both are HttpOnly cookies, so JavaScript cannot read them.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant SPA as React SPA
    participant API as AuthController
    participant AS as AuthService
    participant RT as RefreshTokenService
    participant DB as SQL Server

    U->>SPA: Enter email and password, tick Keep me signed in
    SPA->>API: POST /api/auth/login
    Note over API: Rate limit "auth" 10 per minute per IP
    API->>AS: LoginAsync
    AS->>DB: Find the account by email
    alt Wrong email or password
        API-->>SPA: 401 invalid_credentials
    else Not activated or locked
        API-->>SPA: 403 account_not_active or account_locked
    else Valid
        opt Legacy plain-text password from the MVC site
            AS->>DB: Re-hash the password right away
        end
        API->>RT: IssueAsync(userId, 30 days or 24 hours)
        RT->>DB: INSERT RefreshTokens (hash only)
        API-->>SPA: 200, Set-Cookie jf_at (15 min), jf_rt (sent only to /api/auth), jf_si
    end

    Note over SPA,API: 15 minutes later the access token has expired
    SPA->>API: GET /api/orders (expired jf_at cookie)
    API-->>SPA: 401
    SPA->>API: POST /api/auth/refresh (jf_rt cookie), one refresh at a time per tab
    API->>RT: RotateAsync(token)
    alt Token is valid
        RT->>DB: Revoke the old token and set ReplacedByHash (atomic)
        RT->>DB: INSERT the new token
        API-->>SPA: 200, new cookies
        SPA->>API: Retry GET /api/orders
    else Another tab refreshed first (within 30 seconds)
        API-->>SPA: 409 refresh_superseded, the browser already has new cookies, so just retry
    else An old token is reused after 30 seconds (possible theft)
        RT->>DB: Revoke every session of the account
        API-->>SPA: 401, cookies cleared, the user must sign in again
    end
```

## 3. Sign up and activate the account

```mermaid
sequenceDiagram
    autonumber
    actor U as Visitor
    participant SPA as React SPA
    participant API as AuthController
    participant AS as AuthService
    participant DB as SQL Server
    participant EQ as Email queue
    participant MAIL as Visitor's mailbox

    U->>SPA: Enter name, email, phone and password
    SPA->>API: POST /api/auth/register (Accept-Language = current UI language)
    API->>AS: RegisterAsync(request, language)
    AS->>DB: Look up the email
    alt The email belongs to an active account
        API-->>SPA: 409 email_taken
    else New email, or an unfinished earlier sign-up
        AS->>DB: Create or update the inactive account, 6-digit code valid for 30 minutes
        AS->>EQ: Activation code email in the visitor's language
        API-->>SPA: 202, move to the code step
        EQ-)MAIL: Send the email (in the background)
    end
    U->>SPA: Enter the code received
    SPA->>API: POST /api/auth/activate (email, code)
    API->>AS: ActivateAsync
    alt Wrong code
        API-->>SPA: 400 activation_invalid
    else Code expired
        API-->>SPA: 400 activation_expired, the visitor clicks "Send a new code"
    else Correct code
        AS->>DB: Activate the account, clear the code
        API-->>SPA: 200 and signed in straight away (Set-Cookie as in flow 2)
    end
```

## 4. Track an order (guest)

No account needed: just the order code and the phone number used when ordering. The "Track order" button in the email opens this page with both filled in and looks the order up automatically.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant SPA as React SPA
    participant API as OrdersController
    participant OS as OrderService
    participant DB as SQL Server

    C->>SPA: Open /track, enter order code and phone number
    SPA->>API: POST /api/orders/track (code, phone)
    Note over API: Rate limit "auth" 10 per minute per IP, against guessing order codes
    API->>OS: TrackAsync
    OS->>OS: Normalise the phone (+84 901 234 567 becomes 0901234567)
    OS->>DB: Find the order by code
    alt No such order, or the phone does not match
        API-->>SPA: 404 (does not reveal whether the order exists)
    else Match
        OS->>DB: Read the order lines and status history
        API-->>SPA: 200 order details and progress
        SPA-->>C: Current status and timeline
    end
```

## 5. Search as you type

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant SPA as React SPA
    participant CACHE as Output cache (60 seconds)
    participant API as SearchController
    participant SS as SearchService
    participant DB as SQL Server

    C->>SPA: Type "sushi ca hoi" (accents optional)
    SPA->>SPA: Wait 180 ms after the last key, cancel the previous request if still running
    SPA->>CACHE: GET /api/search/suggest?q=sushi ca hoi&limit=6
    alt Already cached (same query and language)
        CACHE-->>SPA: 200 cached result
    else Not cached
        CACHE->>API: Forward the request
        API->>SS: SuggestAsync(q, language)
        SS->>SS: SearchNormalizer removes accents and splits words: sushi, ca, hoi
        SS->>DB: Products whose SearchText contains every word (names in all 5 languages)
        SS->>DB: Categories whose name matches
        SS-->>API: Up to 6 dishes and 4 categories, translated into the customer's language
        API-->>CACHE: 200
        CACHE-->>SPA: 200 (and keep it for 60 seconds)
    end
    SPA-->>C: Suggestion list, pick with the mouse or arrow keys
```

## 6. Staff update an order's status

Valid order: Pending → Confirmed → (Preparing) → Out for delivery → Delivered → (Refunded). An order can only be cancelled before it goes out for delivery.

```mermaid
sequenceDiagram
    autonumber
    actor S as Staff member
    participant SPA as Back office
    participant AUTH as JWT check
    participant API as AdminOrdersController
    participant OS as OrderService
    participant DB as SQL Server
    participant EQ as Email queue

    S->>SPA: Choose the new status, write a note for the customer
    SPA->>AUTH: POST /api/admin/orders/{id}/status
    AUTH->>DB: Re-check role and lock state (30-second cache)
    alt Locked or role removed
        AUTH-->>SPA: 401
    else Still Staff or Admin
        AUTH->>API: Pass through
        API->>OS: UpdateStatusAsync(id, status, note, changed by)
        critical One transaction
            OS->>DB: Read the order and its lines
            OS->>OS: Check the transition table (OrderService.Transitions)
            opt Cancelling an order that holds stock
                OS->>DB: Return the stock, decrease SoldCount
                OS->>DB: Give the coupon use back
            end
            opt Delivered and paid by cash on delivery
                OS->>DB: PaymentStatus = Paid, PaidAt = now
            end
            OS->>DB: UPDATE Orders.Status, INSERT OrderStatusHistory
        option Invalid transition (e.g. Delivered back to Pending)
            OS-->>SPA: 409 invalid_status_transition
        end
        opt The order has an email
            OS->>EQ: Status update email in the language the customer ordered in
        end
        API-->>SPA: 200 updated order
        SPA-->>S: A new step appears in the order's progress
    end
```

## 7. Staff edit a dish (with AI translation)

"Translate with AI" is optional: it only appears when the server has `Anthropic:ApiKey`. The translation is only a draft in the form; staff review it before saving.

```mermaid
sequenceDiagram
    autonumber
    actor S as Staff member
    participant SPA as Back office
    participant API as Admin controllers
    participant AI as AiTranslator
    participant CL as Claude API
    participant PS as AdminProductService
    participant IDX as SearchIndexer
    participant DB as SQL Server
    participant CACHE as Output cache

    S->>SPA: Edit the Vietnamese name and descriptions, price, stock
    opt Click "Translate with AI"
        SPA->>API: POST /api/admin/translate (kind dish, fields, en ja ko fr)
        Note over API: Rate limit "ai" because every call costs money
        API->>AI: TranslateAsync
        AI->>CL: Messages API, answer constrained to a JSON schema
        CL-->>AI: A translation for each language
        AI-->>SPA: Drafts filled into the language tabs
        S->>SPA: Review and adjust
    end
    S->>SPA: Click Save changes
    SPA->>API: PUT /api/admin/products/{id}
    API->>PS: UpdateAsync
    alt Invalid data (e.g. sale price not below the regular price)
        PS-->>SPA: 400 validation_failed, errors shown under each field
    else Valid
        PS->>DB: UPDATE Products, ProductTranslations
        PS->>IDX: RebuildAsync(productId)
        IDX->>DB: Update SearchName, SearchText (accent-free, all languages)
        API->>CACHE: EvictByTag("catalog")
        API-->>SPA: 200
        SPA-->>S: "Saved", customers see the change immediately
    end
```
