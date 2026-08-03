# Emporix Journey Aware Storefront — Project Summary

> **Status snapshot:** Next.js 16 / React 19 / TypeScript-strict B2B commerce frontend for the Emporix platform. Multi-tenant, multi-locale, CMS-agnostic, DI-driven, with a strict three-layer architecture and a code-generated InversifyJS container.

---

## Table of Contents

1. [Mission & Positioning](#1-mission--positioning)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Three-Layer Platform](#4-three-layer-platform)
5. [Dependency Injection (InversifyJS)](#5-dependency-injection-inversifyjs)
6. [Multi-Tenant & i18n Routing](#6-multi-tenant--i18n-routing)
7. [CMS Subsystem (Adapter-Only)](#7-cms-subsystem-adapter-only)
8. [Authentication & Sessions](#8-authentication--sessions)
9. [State Management](#9-state-management)
10. [Design System & UI](#10-design-system--ui)
11. [Forms, Validation, Errors](#11-forms-validation-errors)
12. [Observability & Health](#12-observability--health)
13. [Security Model](#13-security-model)
14. [Testing Strategy](#14-testing-strategy)
15. [Build, CI/CD & Tooling](#15-build-cicd--tooling)
16. [Current Branch — SHOW-323 (Storyblok Hardening)](#16-current-branch--show-323-storyblok-hardening)
17. [Known Gaps & Roadmap](#17-known-gaps--roadmap)
18. [Repository Layout](#18-repository-layout)

---

## 1. Mission & Positioning

The **Emporix Journey Aware Storefront** (internal codename "Showcase") is a production-grade reference storefront for the [Emporix](https://emporix.com) headless B2B commerce platform. It is intentionally positioned as a *foundation*, not a turnkey product:

- **Head-start, not endpoint.** Pre-built MVP flows (browse, PDP, cart, checkout, login, register, order history) demonstrate "the right way" — but the README explicitly says: *"Not everything is pre-built. We want to give you a solid foundation, rather than a ready-to-use solution."*
- **Composable by design.** Business logic (pricing, search, CMS, payment, approval, quote) is exchangeable behind interfaces. Vendors are integrations, not core.
- **B2B-first.** Account management & service portal, approval workflow (Beta), quote/offer management (Beta), and customer-segment-aware pricing differentiate it from a generic B2C demo.
- **Performance budget.** Lighthouse 90+ from day one — enforced through caching headers, RSC-by-default rendering, image/font optimization, and bundle discipline (browser must never import server containers).

---

## 2. High-Level Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │             Browser (React 19)                │
                  │   Client Components · Zustand stores · forms │
                  └──────────────────────────────────────────────┘
                                      │  fetch /api/*
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router (Edge + Node)              │
│   src/app/[site]/[locale]/                                          │
│   ├── (default)   full header/footer                                │
│   ├── (reduced)   minimal layout (checkout)                         │
│   ├── (no-margin) full-bleed CMS pages                              │
│   ├── @dialog     parallel route                                    │
│   └── api/*       REST endpoints                                    │
└────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│   src/platform — Backend in the Frontend                            │
│   ┌────────────┐    ┌────────────┐    ┌────────────────────────┐  │
│   │  Services  │ ←─ │  Services  │ ←─ │  Integrations          │  │
│   │  (domain)  │    │  facade    │    │  Emporix · BatteryIncl │  │
│   │            │    │            │    │  Storyblok · OpenMeteo │  │
│   └────────────┘    └────────────┘    │  Local JSON · AI       │  │
│                                       └────────────────────────┘  │
│   InversifyJS DI · generated containers (server.ts / ssr.ts)        │
└────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                ┌────────────────────────────────────────┐
                │  External: Emporix API · Storyblok ·   │
                │  BatteryIncluded · OpenMeteo · Web-Push│
                └────────────────────────────────────────┘
```

Two unidirectional flows meet at the **Service Layer**:

```
Integration → Service ← React Application
```

The browser **never** holds the DI container by default (`NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is off). Client code uses `@/lib/client/*` and `fetch('/api/*')` as the security boundary.

---

## 3. Technology Stack

| Concern              | Library / Tool                                                       | Version    |
|----------------------|----------------------------------------------------------------------|------------|
| Framework            | Next.js (App Router, Turbopack dev, RSC default)                     | 16.2.4     |
| UI runtime           | React + React DOM                                                    | 19.2.1     |
| Language             | TypeScript (strict)                                                  | 5.8.3      |
| DI Container         | InversifyJS (code-generated)                                         | 7.10.4     |
| Auth                 | NextAuth (Auth.js v5, beta)                                          | 5.0.0-b.30 |
| i18n                 | next-intl + next-intl-split                                          | 4.4.0      |
| State (client)       | Zustand                                                              | 5.0.8      |
| Forms                | react-hook-form + zod + @hookform/resolvers                          | 7.66 / 3.25 |
| Styling              | Tailwind CSS 4 (PostCSS, `@theme inline`) + class-variance-authority | 4.1.6      |
| UI Primitives        | Radix UI (Dialog, Popover, Select, …)                                | various    |
| Component library    | shadcn-style (components.json), Lucide + Lucide-lab icons            | —          |
| Motion               | motion (nav only)                                                    | 12.23      |
| Carousel             | embla-carousel-react                                                 | 8.6        |
| Charts               | recharts (dashboard)                                                 | 2.15       |
| Layout (dashboard)   | react-grid-layout                                                    | 1.5.2      |
| Drawer               | vaul                                                                 | 1.1.2      |
| Toasts               | sonner                                                               | 2.0.7      |
| Themes               | next-themes (installed, no toggle in UI yet)                         | 0.4.6      |
| CMS (default option) | @storyblok/react                                                     | 5.4.18     |
| Sanitization         | DOMPurify (AI HTML only)                                             | 3.3.1      |
| HTTP / Web Push      | web-push (VAPID)                                                     | 3.6.7      |
| Cookies              | js-cookie, universal-cookie                                          | —          |
| Logging              | pino + pino-pretty                                                   | 10.1.0     |
| Metrics              | prom-client (opt-in)                                                 | 15.1.3     |
| Rate limiter         | rate-limiter-flexible (declared, not yet wired)                      | 7.2.0      |
| Weather              | openmeteo                                                            | 1.2.2      |
| Testing              | Jest 30 + jest-environment-jsdom + @testing-library/react            | 30.2.0     |
| E2E                  | Playwright                                                           | 1.56.1     |
| Linting              | ESLint 9 (flat config) + jsx-a11y + unused-imports                   | 9.31.0     |
| Formatter            | Prettier + trivago import sorter + tailwindcss plugin                | 3.6.2      |

**Notable absences / dead deps:** `react-redux`, `@preact/signals-react`, and `@builder.io/partytown` are installed but **not used**. Zustand is the only active state manager. No GTM/GA/dataLayer — analytics is not wired.

---

## 4. Three-Layer Platform

The folder `src/platform/` is the project's domain backbone. It is a *backend in the frontend* with strict layering enforced by code, naming, and tests:

```
src/platform/
├── core/            # DI primitives (@injectable), logger, http
├── integrations/    # 1) external API clients (vendor-specific)
│   ├── emporix/     #    cart, product, category, order, customer, payment …
│   ├── batteryincluded/  search & recommendations
│   ├── storyblok/   #    CMS provider adapter
│   ├── openmeteo/   #    weather
│   ├── local/       #    JSON-file CMS provider
│   ├── ai/          #    generative AI hooks
│   └── types/
├── repositories/    # 3) data-access (when persistence is local)
└── services/        # 2) domain logic + mappers + DTO↔model translation
    ├── cart, checkout, order, product, category, customer, customer-segment,
    │   approval, quote, return, payment, price, shipping, search, session,
    │   site, weather, validation, notification, schema, stock, ssr,
    │   tracking, logger, metrics, request-context, setup, ai, model,
    │   auth, company, cms
    └── cms/         #  CMSService facade + CmsAdapter SPI + provider resolver
```

### Layer Contracts

| Layer        | Responsibility                                                                                   | May depend on        |
|--------------|---------------------------------------------------------------------------------------------------|----------------------|
| Integration  | HTTP/SDK calls, vendor DTOs, auth headers, retries, vendor-specific caching                       | (nothing internal)   |
| Service      | Business logic, DTO→domain mapping, cross-vendor orchestration, validation, transactions          | Integration          |
| React App    | Pages, components, hooks, stores — calls services either directly (RSC) or via `/api/*`           | Service              |

Each adjacent edge is unidirectional. Skip-layer calls are forbidden — caught by the DI generator and by drift-guard tests (e.g. `renderer-provider-agnostic.drift.test.ts` in the CMS subsystem).

### Naming Conventions (authoritative)

- **Integration interface:** `(Vendor)(Domain)Api.d.ts` → e.g. `EmporixCartApi.d.ts`
- **Integration impl:** `impl/(Vendor)(Domain)Api.ts`, aliased internally as `I(Vendor)(Domain)Api`
- **Service interface:** `(Domain)Service.d.ts` → e.g. `CartService.d.ts`
- **Service impl:** `impl/(Vendor)(Domain)Service.ts` → e.g. `EmporixCartService.ts`
- **Vendor model:** `(Vendor)(Model)` → e.g. `EmporixCart`, separate from domain `Cart`
- **Environment-suffix:** `*Server` / `*SSR` / `*Client` to target a specific container; no suffix → all containers

---

## 5. Dependency Injection (InversifyJS)

DI is provided by InversifyJS, but bindings are **code-generated** — never written by hand.

- Generator: `scripts/di-generator.ts` (run `npm run generate`, or `generate:watch` for hot scan)
- Reads: `@injectable('ServiceId', 'Singleton'|'Transient')` decorators across `src/platform/`
- Aliases: `depency.yml` (sic) lets a vendor binding be swapped at build time without changing call sites
- Emits:
  - `src/platform/server.ts` — Node server runtime, top of file `import 'server-only'`
  - `src/platform/ssr.ts` — RSC / streaming runtime, `import 'server-only'`
  - `src/platform/client.ts` — **only when** `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true` (off by default; auditable browser-loadable graph)

### Suffix Classification

| Suffix     | Goes into          | Notes                                       |
|------------|--------------------|---------------------------------------------|
| `*Server`  | `server.ts`        | Node-only, has access to `headers()` etc.   |
| `*SSR`     | `ssr.ts`           | RSC-safe, no Node-only APIs                 |
| `*Client`  | `client.ts` (opt-in) | Audited browser bundle, rarely needed     |
| *no suffix*| all containers     | Pure logic, runtime-agnostic                |

The browser falls back to `@/lib/client/*` + `fetch('/api/*')` when DI is off — the *security boundary* of the application.

### Extensions

The `extensions/` folder is a plugin system declared by `plugin.json` files; they can register additional adapters/services without touching application code.

---

## 6. Multi-Tenant & i18n Routing

The application is multi-site **and** multi-locale, fronted by a middleware chain at `src/proxy.ts`:

```
URL: /{site}/{locale}/path
      └── e.g. /main/de/products/123
              /us-branch/en/cart
```

### Resolution Order (`src/site/middleware.ts`)

1. **Domain match** (pre-auth) — `showcase.emporix.la` → default site mapping
2. **Path-based** — first segment after host
3. **Cookie-based** — `routing.cookie`
4. **Header-based** — `routing.header`
5. **Default site** — last-resort fallback per `src/site/config.ts`

### Layout Groups

| Route group   | Use case                                          |
|---------------|---------------------------------------------------|
| `(default)`   | Standard pages with full header & footer          |
| `(reduced)`   | Checkout/funnel — minimal chrome to reduce churn  |
| `(no-margin)` | CMS pages and landing pages with full-bleed hero  |
| `@dialog`     | Parallel route slot — login, address, dialogs     |

### i18n

- **Library:** `next-intl` + `next-intl-split` (per-route message chunking)
- **Locales:** `en`, `de` (extensible via `src/i18n/translations/`)
- **Dynamic keys:** `dk()` helper in `src/i18n/dynamic-key.ts` + a typed `ValidationKey` union
- **Navigation rule:** always import from `@/i18n/navigation`, **never** from `next/navigation` directly — keeps `Link` and `useRouter` locale-aware.

---

## 7. CMS Subsystem (Adapter-Only)

The most architecturally distinctive part of the codebase. Two ADRs govern it:

- **ADR 0001 — CMS providers are integrated solely through adapters** (2026-05-27)
- **ADR 0002 — CMS components are co-located and schema-first**

### The SPI

```ts
interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  // Optional provider-side editing surface:
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  BridgeScript?: ComponentType;
}
```

### Render Pipeline

```
┌─────────────────────┐  getPage()  ┌──────────────┐  walks body[]  ┌──────────────────┐
│  <Provider>Adapter  │ ──────────► │   CMSPage    │ ─────────────► │   CmsRenderer    │
│  + <Provider>Mapper │  wire→model │ (agnostic)   │                │ + cmsComponentMap│
└─────────────────────┘             └──────────────┘                └──────────────────┘
   provider-specific                    shared, agnostic                shared, agnostic
        ▲
        │  optional: getEditableProps / BridgeScript
```

### Shipped Adapters

| Adapter           | Source                  | Use case                                        |
|-------------------|-------------------------|-------------------------------------------------|
| `StoryblokCmsAdapter` | Storyblok REST API   | Editorial-grade CMS with Visual Editor          |
| `LocalJsonCmsAdapter` | `src/data/cms/<site>/<locale>/<slug>.json` | Demo / dev / no-vendor mode |
| `NoneCmsAdapter`  | empty                   | Boot resilience — never crashes the app         |
| `FallbackCmsAdapter` | composite             | Wraps a primary with a fallback source (e.g. `_default_` site) for fresh clones |

`getCmsService()` (in `src/platform/services/cms/get-cms-service.ts`) is a *lazy-bind helper* that resolves `CMS_PROVIDER` from env and binds the right adapter on the active container — safe across the Turbopack module-graph split.

### Provider IDs

A typed tuple: `CMS_PROVIDER_IDS = ['storyblok', 'local', 'none']`. Adding a provider = one folder under `src/platform/integrations/<name>/cms/impl/` + an entry in the tuple. **No application code changes.**

### Drift Guards (enforced as code)

- `renderer-provider-agnostic.drift.test.ts` fails the build if the central renderer or shell imports from `@/platform/integrations/*` or a provider SDK.
- Browser-bundle smoke (`verify:client-chunks`) ensures no Storyblok token leaks into client chunks.

---

## 8. Authentication & Sessions

- **NextAuth v5** with Credentials + SSO providers
- **Strategy:** JWT session, no Auth.js database
- **Backing store:** Authentication is delegated to the Emporix backend; the API token returned by Emporix is stored base64-encoded inside an `httpOnly` cookie
- **Service token:** held only in server RAM, never exposed
- **SSO flow:** the email plus a server secret is hashed (`sha256(SECRET + email)`) into a deterministic password that's used against Emporix
- **CSRF:** dedicated `/api/csrf` endpoint sets an `httpOnly` cookie; verification is opportunistic
- **Authorization model:** API routes do **not** enforce their own auth — the Emporix backend is the source of truth (documented as `sec_authorization-model`)

### Token Manager

`EmporixTokenManager` handles four kinds of tokens:

| Token type     | Scope                | Cache                           |
|----------------|----------------------|---------------------------------|
| Public         | Storefront API key   | `globalThis` cache, ~3200s TTL  |
| Anonymous      | Guest carts          | Per session                     |
| Customer       | Logged-in user       | Per session                     |
| Service        | Privileged backend   | Server-only, cache key includes secret |

Thundering-herd prevention via promise deduplication.

---

## 9. State Management

- **Active library:** Zustand
- **Pattern:** Context-bound stores — **no singletons**. Per-request store factories prevent SSR cross-request leaks.
- **Cross-store sync:** explicit subscribers, not implicit dependencies
- **Inactive libraries:** `react-redux` and `@preact/signals-react` are installed but unused (dead deps slated for removal)
- **12 stores** in `src/stores/` covering cart, session, notifications, dashboard layout, search facets, etc.

---

## 10. Design System & UI

### Layered Token Architecture

```
brand tokens     →  OKLCH-based palette (e.g. blue-500, grey-900)
   ↓
alias tokens     →  semantic mapping (e.g. primary, secondary, accent)
   ↓
mapped tokens    →  context-specific (button-fg, card-bg, …)
   ↓
globals.css      →  @theme inline → Tailwind v4 utilities
```

- **Typography:** Ubuntu (headlines) + Open Sans (body); responsive scale; buttons uppercase with letter-spacing
- **Color:** OKLCH base, semantic aliases, computed `lab()` values for fine contrast control
- **Spacing scale:** 0–64px; `border-radius-sm = 4px` (buttons, inputs)
- **Shadows:** 6 levels (xs–2xl), grey-900 at 5%/10%
- **Breakpoints:** `sm:768`, `md:1024`, `lg:1280` — defined in 3 places that are *not yet synced* (globals.css / `useBreakpoint.ts` / dashboard) — flagged as tech-debt under SHOW-320
- **Theme:** `next-themes` is installed but **no toggle is exposed in the UI**

### Components

- **Base UI:** `src/components/ui/` (shadcn-style, Radix-driven)
- **Molecules:** `src/components/ui/molecules/`
- **Domain folders:** account, address, breadcrumb, cart, checkout, cms, common, footer, header, icons, login, notification, password, product, register, search, seo
- **CMS Renderer Registry:** `cmsComponentMap` resolves CMS component types to React components
- **Component IDs:** 261 components total; **193 are client components** (RSC adoption is partial)

---

## 11. Forms, Validation, Errors

- **react-hook-form + zod + @hookform/resolvers** is the canonical form stack
- **Validation keys:** typed `ValidationKey` union in `src/i18n/dynamic-key.ts` for i18n-safe error messages
- **API boundary validation:** **not enforced** — zod is used in forms and a generic `ValidationService`, but **not** at every upstream API edge (documented gap)
- **Error mapping:** domain-specific error mappers in services; `EmporixApiError` translates vendor errors to internal exceptions
- **Toasts:** `sonner` is the user-facing channel
- **204 semantics:** preserved at the route layer
- **Info-leak risk:** some routes return raw `error.message` strings — flagged as `sec_error-handling`

---

## 12. Observability & Health

### Logging (PINO)

- **Server-side:** `LoggerService` resolved via DI, structured JSON output
- **Browser-side:** `getLogger()` from `@/lib/logger/use-logger-client`
- **Hook:** `useLogger()` in components
- **Streams:** can be split for debug; not for analytics

### Metrics (Prometheus)

- `prom-client` exposes `emx_bff_api_*` counters & histograms
- Opt-in via `NEXT_METRICS_ENABLED`
- Endpoint: `src/metrics-server.ts`

### Health Checks

- `/api/health` — used by the Playwright `webServer` config to gate E2E startup
- `src/platform/healthcheck/env-validation.ts` — Tier-2 startup validation

### Instrumentation

- `src/instrumentation.ts` — Next.js instrumentation hook; primes DI containers and the active CMS adapter

### No Analytics Layer

- No GTM / GA / dataLayer / e-commerce events
- No consent manager (CMP) — will become mandatory once analytics is wired
- `@builder.io/partytown` is installed but unused

---

## 13. Security Model

| Surface           | Mechanism                                                            |
|-------------------|----------------------------------------------------------------------|
| AuthN             | NextAuth Credentials/SSO → Emporix backend                           |
| Token storage     | base64 in `httpOnly` cookie; service tokens server-only              |
| AuthZ             | Delegated to Emporix; API routes do not double-check                 |
| Secrets           | `NEXT_PUBLIC_*` is the only client-exposure surface — enforced by lint |
| Browser bundle    | Storyblok/CMS server tokens forbidden in client chunks (eslint + smoke)|
| XSS               | DOMPurify only for AI HTML; product descriptions still raw (`dangerouslySetInnerHTML`) |
| Input validation  | zod present in forms; **not flat** across API boundaries             |
| CSRF              | `/api/csrf` sets `httpOnly` cookie; verification opportunistic       |
| Headers           | next.config sets standard headers; **no CSP yet**, HSTS prod-only    |
| Rate limit        | `rate-limiter-flexible` declared but **not wired**                   |
| Setup endpoint    | `/api/setup` bearer-protected; default off; string compare not timing-safe |
| Web Push          | VAPID; subscriptions as Emporix CustomEntities; OOTB disabled        |
| Tenant isolation  | site cookie/header guarded against cross-tenant override             |

### Recent Hardening (SHOW-323 / EMP-21)

- All `NEXT_PUBLIC_STORYBLOK_*` and `NEXT_PUBLIC_CMS_*` env vars **removed** from the client surface
- New ESLint rule forbids re-introduction
- AST-loophole closed: computed access (`env['NEXT_PUBLIC_…']`) and destructuring are guarded
- Browser-bundle smoke audits the compiled chunks at build time

---

## 14. Testing Strategy

### Jest (Unit + Integration)

- **30.2.0**, 4 projects with different environments/transformers
- Run wrapper: `scripts/run-jest.cjs` (Node 22+ workaround — *never* run `npx jest` directly)
- **Tier-1 env assertion** + `RUN_INTEGRATION_TESTS` flag gate integration tests
- **Setup files:**
  - `jest.react.setup.js` — jsdom + jest-dom + next-intl mocks
  - `jest.platform.setup.js` — server-side platform tests
- **Mocking patterns:**
  - Hooks: heavy `jest.mock`
  - Platform-integration tests: real HTTP calls against an Emporix tenant
  - API routes: mocked DI container
- **Test count:** 92 testfiles
- **Coverage:** no thresholds configured

### Playwright (E2E)

- **1.56.1**, 3 browsers
- `webServer` waits for `/api/health` before running
- Auth-protected flows gated on `E2E_LOGIN_EMAIL` / `E2E_LOGIN_PASSWORD`
- **Coverage gaps:** checkout, cart, full product flow, search have **no E2E coverage yet**
- **In CI:** Playwright is currently **commented out** in all CI workflows; runs only locally

### Drift Guards

- `renderer-provider-agnostic.drift.test.ts` — CMS layer purity
- `getCmsService` lazy-bind contract test
- Browser-chunk verifier (`verify:client-chunks`)

---

## 15. Build, CI/CD & Tooling

### Build Chain (`npm run build`)

```
generate → next build → check-translations → lint
```

- **DI generation** is mandatory: `scripts/di-generator.ts`
- **Translation completeness:** `scripts/check-translations.ts` (strict mode available)
- **Lint:** ESLint flat config with `no-console` warn, `jsx-a11y`, `unused-imports`, env-gated `@/platform/client` restriction
- **CI:** does **not** call the `build` script directly; **Vercel** runs the build

### Pipelines

- 9 GitHub Actions workflows
- Vercel preview/production targets
- E2E currently disabled in CI (lives locally)
- `safe-chain` (offline-safe npm) included in all workflows

### Dependency Hygiene

- `save-exact = true`
- `min-release-age = 7 days`
- `npm@11.10.0` pinned
- Renovate updates allowed only after the age window

### Pre-commit

- **Prettier only** via `lint-staged`
- **No** lint/test/typecheck pre-commit (intentionally — CI catches them)
- **No** pre-push

### Utility Scripts

- `setup-api` — Emporix tenant bootstrap
- `generate-sso-password` — deterministic SSO secret
- `generate-vapid-keys` — Web Push
- `verify-client-chunks` — token-leak audit on the browser bundle

### next.config.ts

- Turbopack root-fix
- Security headers (no CSP yet, no X-Frame-Options)
- `output: 'export'` is forbidden
- `ignore-loader` for test artifacts

---

## 16. Current Branch — SHOW-323 (Storyblok Hardening)

The active branch `feature/SHOW-323` consolidates a sweep of CMS hardening, broken into 9 slices (EMP-13 through EMP-25, visible in the `.claude/SHOW-323-*` plan files). Highlights from the most recent 30 commits:

| Phase        | What landed                                                                              |
|--------------|------------------------------------------------------------------------------------------|
| Phase A      | Renamed `NEXT_PUBLIC_{CMS,STORYBLOK_*}_*` → `NEXT_*` (server-side only)                  |
| Phase B      | Bridge bootstrap moved into a **server action** — no client token exposure               |
| Phase C      | Top-banner fetch refactored: `fetchTopBanner` + safer `use-banner` hook                  |
| Phase D      | Per-site theming + browser smoke for theme application                                   |
| Phase E      | CMS webhook + HMAC + targeted cache invalidation                                         |
| Phase F      | Provider-agnostic preview route via SPI split                                            |
| Phase G      | Composite default-content fallback + production-build smoke                              |
| EMP-21       | Final cleanup: AST-level guard closes the loophole around computed access & destructuring|
| Security ADR | ADR 0001 (adapter-only) + ADR 0002 (component co-location) ratified                      |

The branch turned the storefront from "Storyblok-coupled" to "CMS-provider-agnostic" without changing any application code outside the `cms/` subsystem — a litmus test for the layered architecture.

---

## 17. Known Gaps & Roadmap

### Known Issues (from README)

- Session invalidation during SSR can leave the client unaware (cookie-write window lost)
- Cart migration (anon → logged-in) is incomplete
- API endpoints are not separately secured (relies on Emporix)
- Not all CMS components follow hybrid-CMS compatibility — only a sampler
- No caching at the integration layer yet
- Some unit tests depend on tenant-specific seed data — must be created manually

### Roadmap / Tech Debt (from internal memory)

- Wire `rate-limiter-flexible`
- Add CSP and `X-Frame-Options`
- Build a real analytics layer (currently absent) → needs a CMP first
- Resolve the breakpoint-token split (SHOW-320)
- Expose `next-themes` toggle and dark-mode tokens
- Backfill E2E coverage for checkout, cart, product, search
- Remove dead deps (`react-redux`, `@preact/signals-react`, `partytown`)
- Sanitize raw product descriptions (replace `dangerouslySetInnerHTML`)
- Make Storyblok endpoint configurable (currently hard-coded to `api.storyblok.com`)

---

## 18. Repository Layout

```
emporix-showcase/
├── .claude/                     # plans, agent memory, skills (this repo's AI scaffolding)
├── docs/                        # architecture + ADRs
│   ├── adr/                     # decision records (CMS adapter rule, co-location)
│   └── *.md                     # layered arch, DI, env, security, testing, CMS, …
├── e2e/                         # Playwright specs
├── extensions/                  # plugin folder (plugin.json + adapters)
├── jest/                        # jest helpers
├── public/                      # static assets, fonts, images
├── resources/                   # 35+ Emporix OpenAPI specs, fixtures
├── scripts/                     # di-generator, setup-api, translation checker, …
└── src/
    ├── app/                     # Next.js App Router
    │   └── [site]/[locale]/(default|reduced|no-margin)
    ├── auth/                    # NextAuth glue
    ├── caching/                 # cache utilities
    ├── components/              # 261 components, 19 domain folders
    ├── data/cms/                # local-CMS JSON fixtures
    ├── hooks/                   # custom React hooks
    ├── i18n/                    # next-intl config + translations
    ├── lib/                     # shared, framework-agnostic helpers
    │   ├── client/              # browser-only (no DI)
    │   └── logger/              # PINO wrappers
    ├── platform/                # **3-layer backend** (see §4)
    ├── providers/               # 9 React providers (bootstrap order matters)
    ├── stores/                  # 12 Zustand stores
    ├── tests/                   # shared test utilities
    └── proxy.ts                 # middleware chain (site / auth / csrf / cache)
```

---

## Closing Notes

The Emporix Journey Aware Storefront treats every external dependency as a *vendor adapter*: Emporix itself, Storyblok, BatteryIncluded, OpenMeteo — all interchangeable behind interfaces. The same rule generalises to future swap-axes (payment, search, AI). What stays stable is the three-layer split, the InversifyJS-generated containers, the multi-tenant URL contract, and the React-first rendering pipeline.

For implementers landing in the repo:

1. Read `docs/layered-architecture.md` and `docs/dependency-injection.md` first.
2. Never edit `src/platform/server.ts`, `ssr.ts`, or `client.ts` by hand — they are generated.
3. New work goes through the `architect → testing-engineer → frontend-developer` agent rotation defined in `.claude/agents/`.
4. The browser must never `import '@/platform/server'` or `@/platform/ssr` — that's the security wall.

— *Generated 2026-06-01 against branch `feature/SHOW-323`.*
