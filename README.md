<div align="center">

# 🍣 VQT Japanese Food

**Full-stack e-commerce for a Japanese food store in Vietnam: a storefront and a back office, in 5 languages**

![.NET 9](https://img.shields.io/badge/.NET-9-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL%20Server-CC2927?style=for-the-badge)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

![Tests](https://img.shields.io/badge/Tests-132%20passing-2ea44f?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-vi%20%C2%B7%20en%20%C2%B7%20ja%20%C2%B7%20ko%20%C2%B7%20fr-0A66C2?style=flat-square)
![Themes](https://img.shields.io/badge/Themes-light%20%C2%B7%20dark%20%C2%B7%20ocean%20%C2%B7%20midnight-6E40C9?style=flat-square)

[Features](#-features) · [Tech Stack](#%EF%B8%8F-tech-stack) · [Documentation](#-documentation) · [Getting Started](#-getting-started) · [Changelog](CHANGELOG.md)

</div>

<div align="justify">

An online Japanese food store built for the Vietnamese market (prices in VND, cash on delivery). It started as a classic ASP.NET MVC website and was rebuilt as a **React single-page app** on an **ASP.NET Core 9 Web API**, with a full back office for the store owner and staff.

</div>

> [!NOTE]
> **Recent changes (26 Oct 2026):** the AI chat assistant has been **removed**, and the translations in all **5 languages** were updated to match. The optional **Translate with AI** button in the back office stays. Details in the [changelog](CHANGELOG.md).

---

## ✨ Features

### 🛍️ Storefront
- **Menu** by section and category, dish pages with photos, reviews and "frequently bought together"
- **Search in any language, accents optional**: type "sashimi ca hoi" and still find "Sashimi cá hồi"
- **Cart and cash-on-delivery checkout** without an account, coupons, free delivery above a threshold
- **Order tracking** with the order code and phone number
- **Customer accounts**: email activation, address book, order history, favourites, reviews

### 🧑‍💼 Back office (`/admin`)
- **Revenue dashboard**: today and 30-day revenue, orders, average order value, best sellers, low-stock alerts
- **Order workflow**: Pending → Confirmed → Preparing → Out for delivery → Delivered, with an email to the customer at every step
- **Dishes** (photos, translations, SEO, bulk actions), **catalog**, **coupons**, **reviews**, **customers**, **Policies & FAQ**, **store settings** and **staff roles**
- **Translate with AI** (optional): drafts the English, Japanese, Korean and French text from the Vietnamese

### 🌏 5 languages · 4 themes

| 🗣️ Languages | 🎨 Themes | 📄 What is translated |
|---|---|---|
| **Vietnamese** (default), **English**, **Japanese**, **Korean**, **French** | **Light**, **Dark**, **Ocean**, **Midnight** | The interface, menu content, policies and every customer email |

### ✉️ Customer emails
- **Order confirmation**, **status updates**, **activation** and **password-reset** codes, in the customer's language, with a dark-mode layout

### 🔒 Built-in safety
- **Server-side pricing**: the browser only sends dish ids and quantities; prices, coupons and totals are recalculated on the server
- **Safe stock handling**: stock is reserved inside a database transaction, so the last item can never be sold twice
- **Sessions**: JWT in HttpOnly cookies, rotating refresh tokens with reuse detection, rate limiting on sign-in and checkout
- **Back-office access** is re-checked on every request, so a locked or demoted staff member loses access almost immediately

---

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| **Backend** | .NET 9, ASP.NET Core Web API, EF Core 9, SQL Server |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query, Zustand, i18next |
| **AI** (optional) | Claude API (`claude-opus-5-5`) through the `Anthropic` C# SDK, only for "Translate with AI" |
| **Testing** | xUnit (in-memory SQLite), Vitest |

---

## 📚 Documentation

| Document | Contents |
|---|---|
| 🧭 [Admin guide](docs/admin-guide.md) | How to use the back office (for the store owner and staff) |
| 🏗️ [Architecture](docs/architecture.md) | Architecture and code conventions (for developers) |
| 🗃️ [ERD](docs/erd.md) | Entity–relationship diagrams of all **24 tables** |
| 🔁 [Sequence diagrams](docs/sequence-diagrams.md) | The **7 main flows**: ordering, sign-in, sign-up, tracking, search, order status, dish editing |
| 🎯 [Use cases](docs/use-cases.md) | Use case diagrams and specifications (**24 use cases**) |
| 🖼️ [Diagrams (PNG)](docs/diagrams/) | Every diagram as an image, for reports and slides |
| 📝 [Changelog](CHANGELOG.md) | What changed and when: chatbot removal, translation updates, rebuild milestones |

---

## 🗂️ Project Structure

```
JapaneseFood.Api/        Web API: controllers, JWT sign-in with cookies, also serves the built frontend
JapaneseFood.Service/    All business logic: orders, products, search, email, back office, AI translation
JapaneseFood.Entity/     DataContext, entities, EF configuration and migrations
JapaneseFood.Common/     Shared enums, SMTP email sending
JapaneseFood.Model/      Old DTOs of the MVC site
JapaneseFood.Tests/      Backend xUnit tests
frontend/                React app (store + /admin)
seed/                    Sample menu data, images and the "Our story" page content
vqt_japanese_food_web/   Legacy MVC site (being replaced; only its Uploads image folder is still used)
docs/                    Documentation and diagrams
```

---

## 🚀 Getting Started

### Requirements

- [.NET SDK 9](https://dotnet.microsoft.com/download) or later (tested with SDK 10)
- [Node.js 22 LTS](https://nodejs.org/) (Vite 8 needs Node 20.19+ or 22.12+)
- SQL Server (Express edition is enough)
- Migration tool: `dotnet tool install --global dotnet-ef`

### First-time setup

**1. Configure secrets.** Passwords and keys never go in `appsettings.json`; during development they live in user-secrets (shared by the API and the MVC site):

```bash
cd JapaneseFood.Api
dotnet user-secrets set "ConnectionStrings:VQTConnections" "Server=localhost\SQLEXPRESS;Initial Catalog=vqt_japanese_food;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:Key" "<random string, at least 32 characters>"
dotnet user-secrets set "SmtpSettings:Password" "<Gmail app password>"          # for sending email
dotnet user-secrets set "Anthropic:ApiKey" "<API key from console.anthropic.com>"  # optional, enables "Translate with AI"
```

Without `Jwt:Key` the API stops at startup and explains how to fix it. Without the SMTP password the site still runs, but emails cannot be sent (errors go to the log). Without `Anthropic:ApiKey` the "Translate with AI" button is hidden.

**2. Create the database:**

```bash
dotnet ef database update --project JapaneseFood.Entity --startup-project JapaneseFood.Api
```

**3. Load the sample menu** (**76 dishes**, openly licensed photos, content in 5 languages; safe to run repeatedly and never overwrites existing prices or stock):

```bash
dotnet run --project JapaneseFood.Api -- --seed-menu seed
```

**4. Install and build the frontend:**

```bash
cd frontend
npm ci
npm run build      # outputs to JapaneseFood.Api/wwwroot
```

### Running

**Option 1: a single port** (same as production):

```bash
dotnet run --project JapaneseFood.Api --launch-profile http
```

Open **http://localhost:5080**. The back office is at **http://localhost:5080/admin**.

**Option 2: while working on the UI** (the page reloads when you save a file). Run the API as above, then in another terminal:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api`, `/Uploads` and `/sitemap.xml` to the API on port 5080, so sign-in cookies keep working.

> [!WARNING]
> **Default administrator account:** `admin@gmail.com` / `123`. Change this password straight away.

> [!TIP]
> In the Development environment a test coupon **`WELCOME10`** is created automatically. Useful addresses: `/health` (liveness check), `/openapi/v1.json` (API description, Development only), `/sitemap.xml`.

---

## 🧪 Testing

```bash
dotnet test JapaneseFood.Tests/JapaneseFood.Tests.csproj    # 84 backend tests
cd frontend && npm test                                     # 48 frontend tests
cd frontend && npm run build                                # TypeScript type check + build
```

Backend tests use in-memory SQLite, so they need **no SQL Server**, and they never call the Claude API, so they **cost nothing**.

---

## ⚙️ Configuration

Non-secret settings live in `JapaneseFood.Api/appsettings.json`:

| Section | Purpose |
|---|---|
| `Jwt` | Session lifetimes (access 15 minutes; refresh 30 days with "Keep me signed in", 24 hours without) |
| `Storage` | Upload folder (`UploadsPath`) and maximum size per image |
| `Cors:Origins` | Other origins allowed to call the API (leave empty when frontend and API share an address) |
| `Ai:Model` | Claude model used by "Translate with AI" |

Store information (name, phone, address, opening hours, delivery fee, free-delivery threshold, and the **website address** used by the "Track order" button in emails) is edited in **Back office → Settings**, no file changes needed.

---

## 📦 Deploying

1. `npm ci && npm run build` in `frontend/`, then `dotnet publish JapaneseFood.Api -c Release`.
2. Provide secrets as environment variables (`:` becomes `__`): `ConnectionStrings__VQTConnections`, `Jwt__Key`, `SmtpSettings__Password`, and `Anthropic__ApiKey` if you use "Translate with AI".
3. Run the migrations against the production database **before** starting the new version.
4. Serve over **HTTPS only** (sign-in cookies are HttpOnly; outside Development the API enables HSTS).
5. In **Settings**, enter the real website address so links in emails are correct.
6. If you use "Translate with AI": set a spending limit for the API key in the Anthropic Console.

---

## 🩺 Troubleshooting

<details>
<summary><b>Show common problems and fixes</b></summary>

| Symptom | Fix |
|---|---|
| `dotnet build` cannot write a DLL (MSB3027) | The running API locks the file: stop the API, build, start it again |
| The API stops with "Database is not ready" | Run `dotnet ef database update` from step 2 |
| Port 5080 or 5173 is busy | Stop the old process, or change the port in `JapaneseFood.Api/Properties/launchSettings.json` / `npm run dev -- --port 5174` |
| No "Translate with AI" button | `Anthropic:ApiKey` is not set (or was set after the API started: restart the API) |
| Customers don't receive emails | Check `SmtpSettings:Password` and the API log |
| The UI on port 5080 doesn't show code changes | Run `npm run build` again (or use `npm run dev` on port 5173) |

</details>

---

## 🔒 Security

- **Never commit** passwords, connection strings with passwords, or API keys: use user-secrets in development and environment variables in production. If a secret is ever committed, change it immediately; deleting the file is not enough because it stays in the Git history.
- **Prices and totals** are always recalculated on the server from the database; the browser only sends dish ids and quantities.
- **The back office re-checks permissions** on every request: a locked or demoted staff member loses access almost immediately.
