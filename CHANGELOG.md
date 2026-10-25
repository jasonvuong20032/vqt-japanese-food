# Changelog

All notable changes to VQT Japanese Food. The public repository starts from a clean history in October 2026, so earlier milestones are summarised here.

## 2026-10-26 · Chatbot removed, translations and documentation updated

### Removed
- **AI chat assistant**, end to end:
  - the chat button and chat window in the store;
  - the chat API (`POST /api/chat`, streamed with server-sent events), the Claude chat model, its tools and the conversation log;
  - the "AI assistant" pages in the back office (conversation history and cost estimates);
  - the `ChatConversations` and `ChatMessages` tables (migration `RemoveChat`).

### Changed
- **Translations in all 5 languages** (Vietnamese, English, Japanese, Korean, French):
  - removed every chatbot text and chat error message from the store and back-office translation files;
  - rewrote, in every language, the back-office texts that referred to the AI assistant (Policies & FAQ page, Store settings).
- **"Translate with AI"** stays as an optional back-office feature: its setting moved from `Chat:Model` to `Ai:Model`, and its rate limit is now called `ai`.
- **Documentation** rewritten in English, with a new [ERD](docs/erd.md), [sequence diagrams](docs/sequence-diagrams.md) and [use case specifications](docs/use-cases.md), plus PNG exports in [docs/diagrams](docs/diagrams/).

### Fixed
- Public catalog pages could return **500 errors** when another visitor closed the page in the middle of a request (requests were sharing one cached database query); every request now runs on its own.

### Security
- The legacy database dump, which contained personal data, is no longer part of the repository.

## 2026-10-04 → 2026-10-11 · Rebuild: React + ASP.NET Core Web API

The legacy MVC site was rebuilt as a React single-page app on an ASP.NET Core 9 Web API.

| Date | Milestone |
|---|---|
| 2026-10-04 | Clean repository; secrets moved out of configuration into user-secrets |
| 2026-10-04 | Service layer and Web API; JWT sign-in with HttpOnly cookies and rotating refresh tokens; server-side checkout with transactional stock handling |
| 2026-10-05 | React storefront: catalog, dish pages, cart, checkout, order tracking, accent-insensitive search in every language |
| 2026-10-05 | AI shop assistant (Claude) with a streaming chat widget, *removed on 2026-10-26* |
| 2026-10-08 | Back office: dashboard, orders, dishes, catalog |
| 2026-10-10 | Back office: customers, staff, coupons, reviews, Policies & FAQ, store settings, "Translate with AI" |
| 2026-10-11 | Customer emails in 5 languages with a dark-mode layout, website address setting, vulnerable packages removed, first documentation |

## 2026-01 · Legacy site

- First version of the store as an ASP.NET MVC website (Razor views and jQuery), kept in `vqt_japanese_food_web/` while it is being replaced.
