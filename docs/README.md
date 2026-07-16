# Emporix Showcase — Documentation

This is the documentation home for the Emporix Showcase (the _Journey Aware Storefront_), a Next.js B2B
commerce storefront built on the Emporix platform with dependency injection (InversifyJS), multi-site
routing, internationalization (next-intl), Auth.js, and a Storyblok / local CMS. It groups the articles
in this folder by area and provides guided reading paths for common tasks.

## How to use this index

- New to the project? Start with **Getting Started**, then skim **Architecture & Core Concepts**.
- Setting up the storefront for a client? Follow the **Frontend Integration** path.
- Tuning integrations or runtime behavior? Follow the **Operations** path.
- Every article ends with a **Related Documentation** section linking back here and to related topics.

## Documentation map

### Getting Started

| Doc | What it covers |
| --- | --- |
| [Run, Build & Deploy](./run-build-deploy.md) | Run, build, and deploy the Next.js app (SSR, Emporix, Auth.js, Storyblok), incl. cloud-platform guidance. |
| [Environment Variables](./environment-variables.md) | Configure NextAuth, Emporix API (client/server), logging, API debug stream, push notifications, and feature flags via `.env`. |
| [Project Structure](./project-structure.md) | Directory tree of the app, components, layered platform (services/repositories), DI container, and state. |

### Architecture & Core Concepts

| Doc | What it covers |
| --- | --- |
| [Layered Architecture](./layered-architecture.md) | Three-layer pattern (Integration, Service, Repository) with InversifyJS DI for decoupled, testable code. |
| [Dependency Injection](./dependency-injection.md) | InversifyJS DI with `server.ts`/`ssr.ts`/`client.ts` containers, `@injectable`, and the optional client-DI flag. |
| [Naming Conventions](./naming-conventions.md) | Naming rules for the Integration/Service layers (`*Api`, `*Service`, interfaces vs. implementations). |
| [Rendering: SSR / SSG / ISR](./rendering-ssr-ssg-isr.md) | App Router rendering modes: SSR per-request, SSG via `generateStaticParams()`, ISR via `revalidate`. |
| [Cache Middleware](./cache-middleware.md) | URL-pattern cache rules, `Cache-Control` / `X-Cache-Tags` headers, default-revalidate env. |
| [Site Middleware](./site-middleware.md) | Multi-site/tenant routing via domain/path/cookie/header resolution and `SitePrefixMode`. |

### Frontend & UI

| Doc | What it covers |
| --- | --- |
| [Styling & Theming](./styling-and-theming.md) | Layered CSS token architecture (`brand.css` → `alias.css` → `mapped.css`) with Tailwind. |
| [UI Components](./ui-components.md) | Component library: Tailwind, shadcn/ui patterns, Radix primitives, Lucide icons, `cva` variants. |
| [Internationalization (i18n)](./i18n-implementation.md) | next-intl with React Server Components, locale-aware routing, typed translations, multi-language files. |
| [Zustand State Management](./zustand-state-management.md) | Zustand stores (product/cart/session) with SSR hydration and React Context providers. |

### Content & CMS

| Doc | What it covers |
| --- | --- |
| [Storyblok Integration](./storyblok-integration.md) | Connect Storyblok headless CMS with Next.js RSC (SDK, access tokens, Visual Editor over HTTPS). |
| [Creating Storyblok Components](./storyblok-components.md) | Build CMS React components in `src/components/cms` with `storyblokEditable` and registration. |
| [Local CMS](./local-cms.md) | Manage content via local JSON in `data/cms` with `_default_` fallback; switch Storyblok ↔ Local. |

### Integrations, Auth & Data

| Doc | What it covers |
| --- | --- |
| [Search Service](./search-service.md) | Swap the `SearchService` DI alias (Emporix ↔ Battery Included) via `depency.yml` / `DI_SEARCH_SERVICE`. |
| [SSO Authentication](./sso-authentication.md) | Auth.js SSO providers with `NEXT_SSO_PASSWORD_SECRET` SHA-256 generation and Emporix customer sync. |
| [API Security](./api-security.md) | NextAuth Edge middleware, CSRF token validation (global fetch override), rate limiting. |
| [Schema Update Process](./schema-update-process.md) | Sync custom entities/schemas from `scripts/` JSON to the Emporix API with version-conflict retry. |
| [File-Based Setup](./file-based-setup.md) | Run setup operations via `POST /api/setup` with the `NEXT_SETUP_API_SECRET` bearer token. |

### Operations & Deployment

| Doc | What it covers |
| --- | --- |
| [Deployment Process](./deployment-process.md) | Multi-environment CI/CD with Vercel + GitHub Actions, env-specific branches and tags. |
| [Health Checks](./health-checks.md) | `/api/health` and `/api/ready` probes for Kubernetes/Azure/GCP (liveness/readiness). |
| [Logging Guide](./logging-guide.md) | PINO structured logging, log-level env vars, API debug streams, Prometheus metrics. |

### Testing & Code Quality

| Doc | What it covers |
| --- | --- |
| [Testing Guide](./testing-guide.md) | Hands-on Jest + Playwright with DI, React-hooks testing, and E2E patterns. |
| [Testing Strategy](./testing-strategy.md) | High-level overview: Jest for unit/integration, Playwright for E2E, CI integration. |
| [ESLint: exhaustive-deps](./eslint-exhaustive-deps.md) | When it is safe to disable `react-hooks/exhaustive-deps` (mount-only effects, stable functions). |

### Concepts & Reference

| Doc | What it covers |
| --- | --- |
| [Wishlist MVP Concept](./wishlist-mvp-concept.md) | Product concept (not a setup guide): wishlist MVP via Emporix Cart API, service layer, BFF routes, Zustand. |

## Guided paths

### Frontend Integration

1. **[Run, Build & Deploy](./run-build-deploy.md)** — get the app running locally; learn build/deploy options.
2. **[Environment Variables](./environment-variables.md)** — set up `.env`: Emporix API keys, NextAuth, feature flags.
3. **[Project Structure](./project-structure.md)** — orient yourself in the codebase.
4. **[Styling & Theming](./styling-and-theming.md)** — apply client branding via the CSS token layers.
5. **[Internationalization](./i18n-implementation.md)** — configure locales and translations.
6. **[Site Middleware](./site-middleware.md)** — set up multi-site / tenant routing.
7. **[Storyblok Integration](./storyblok-integration.md)** + **[Local CMS](./local-cms.md)** — wire up content.
8. **[SSO Authentication](./sso-authentication.md)** _(optional)_ — enable SSO login.
9. **[Deployment Process](./deployment-process.md)** + **[Health Checks](./health-checks.md)** — go live.

### Operations

1. **[Environment Variables](./environment-variables.md)** — the full configuration reference.
2. **[Dependency Injection](./dependency-injection.md)** — how services are wired and swapped.
3. **[Search Service](./search-service.md)** — switch the search backend (Emporix ↔ Battery Included).
4. **[Storyblok Integration](./storyblok-integration.md)** — configure the CMS connection.
5. **[Schema Update Process](./schema-update-process.md)** + **[File-Based Setup](./file-based-setup.md)** — provision schemas/entities and run setup.
6. **[Cache Middleware](./cache-middleware.md)** — tune caching behavior.
7. **[Health Checks](./health-checks.md)** + **[Logging Guide](./logging-guide.md)** — monitoring & observability.
8. **[API Security](./api-security.md)** — token handling, CSRF, rate limiting.

## Notes

- Read **[Naming Conventions](./naming-conventions.md)** before contributing code.
- **[Testing Strategy](./testing-strategy.md)** is the overview; **[Testing Guide](./testing-guide.md)** is hands-on.
- **[Wishlist MVP Concept](./wishlist-mvp-concept.md)** is a product/feature concept, not a setup guide.
