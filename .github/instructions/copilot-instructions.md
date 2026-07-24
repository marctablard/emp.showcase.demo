# Emporix Showcase - GitHub Copilot Instructions

## Overview

Next.js e-commerce showcase (BFF) for the Emporix platform. Follow the architecture and rules below.

## Emporix APIs, MCP tools & documentation sync

### Verify every API call against live docs (mandatory)

Whenever you **write, change, or review** code that sends or receives data from an external API (`lib/client`, `lib/ssr`, `src/platform/integrations/**`, `src/platform/services/**`, `src/app/api/**/route.ts`), query **`mcp_emporixdocs_searchDocumentation`** first and confirm endpoint paths, query params, request/response shapes, field names, and scopes against the current contract ([developer.emporix.io](https://developer.emporix.io)). Never guess or rely on memory. Flag and update obsolete models, renamed fields, or deprecated endpoints. Applies to new **and** existing code you touch.

### Use only raw API fields in upstream queries

BFF mappers add computed/joined fields (e.g. `approver.fullName`) that do **not** exist in the raw API response. When building `q=` filters, query params, or sort keys sent upstream, use **only** fields documented in the raw response schema — mapper-only fields silently return zero results. Trace the relevant `*Mapper` to separate raw fields from locally computed ones.

### Minimize upstream HTTP calls

Prefer the fewest requests. If the API supports multi-id/batch loading (e.g. `q=id:(id1 id2 id3)`), use one request via a shared helper instead of `Promise.all` per-id loops. Fall back to per-id calls only when no batch option is documented.

### Research service interactions with AIBuddy (bigger tasks)

For larger tasks or research, use the **Emporix AIBuddy MCP** to learn how Emporix services talk to each other (flows, dependencies, orchestration) before designing changes.

### Keep `/docs` in sync (mandatory)

The `docs/*.md` files document this codebase. When a change affects behavior covered by a doc (architecture, logging, i18n, DI, testing, middleware, styling, deployment, rendering, caching, etc.), update the matching `docs/*.md` in the **same change** so documentation never drifts from code. If a new subsystem has no doc, add one.

---

## Tech Stack

| Category                 | Technology                                        |
| ------------------------ | ------------------------------------------------- |
| **Framework**            | Next.js 16.2 (App Router)                         |
| **Language**             | TypeScript strict, decorators enabled             |
| **React**                | React 19.2 + Radix UI primitives                  |
| **State Management**     | Zustand 5 + React Context                         |
| **Styling**              | Tailwind CSS 4 + shadcn/ui                         |
| **Internationalization** | next-intl 4.4 with custom site routing            |
| **Dependency Injection** | Inversify 7 (generated containers)                |
| **Authentication**       | NextAuth.js v5 / Auth.js (beta.30)                |
| **Multi-tenancy**        | Custom site middleware                            |
| **Testing**              | Jest (multi-project) + Playwright                 |
| **Logging**              | Pino via `LoggerService`                          |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [site]/[locale]/   # Multi-tenant routes
│   │   ├── (default)/     # Full header/footer layout
│   │   ├── (reduced)/     # Minimal layout (checkout)
│   │   └── (no-margin)/   # Full-width CMS pages
│   └── api/               # API routes (67+)
├── components/            # React components by domain
│   ├── ui/               # shadcn/ui base components
│   └── [domain]/         # Domain-specific components
├── hooks/                 # Custom React hooks by domain
├── lib/
│   ├── client/           # Client-side API calls
│   ├── ssr/              # Server-side data fetching
│   └── server/           # Server utilities
├── platform/              # DI services layer
│   ├── server.ts         # API route container
│   ├── ssr.ts            # SSR container
│   ├── services/         # Service implementations
│   └── integrations/     # External API integrations
├── stores/               # Zustand stores
├── providers/            # React Context providers
├── i18n/                 # Internationalization
└── site/                 # Multi-site routing
```

---

## Multi-Site Architecture

### Site Resolution Order

1. Path segment: `/site-code/en/...`
2. Cookie: `emp-site`
3. Header: `x-request-emp-site`
4. Default: Configured default site

### Required Context in Layouts

```typescript
// Always set request context in layouts
export default async function Layout({ children, params }: Props) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  return <>{children}</>;
}
```

### Navigation

**CRITICAL NAVIGATION RULE (ALWAYS ENFORCE):**
- For internal app navigation, always import from `@/i18n/navigation`.
- Never use `import Link from 'next/link';` for internal routes because it bypasses site-aware/domain-aware prefixing.
- Use plain `<a>` for external URLs (`https://`, `mailto:`, `tel:`, `#fragment`) instead of site-aware `Link`.
- Use `getI18nPathname` only when locale-only path generation is explicitly needed (without site prefix logic).

```typescript
// src/i18n/navigation.ts
import { routing as siteRouting } from '@/site/routing';
import { routing } from './routing';
import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import createNavigation from '@/site/navigation/createNavigation';

// Get i18n pathname helper
export const { getPathname: getI18nPathname } = createIntlNavigation(routing);

// Get site-aware navigation utilities (combines site + locale routing)
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(siteRouting, routing);
```

### Using Site Context

```typescript
// Server Components - Use server-side utilities
import { getRequestSite, setRequestSite } from '@/site/server/';

export default async function Page() {
  const siteCode = getRequestSite();
  // Use site-specific logic
}

// Client Components - Use SiteProvider context
'use client';
import { useContext } from 'react';
import { SiteContext } from '@/providers/SiteProvider';

export function Component() {
  const siteCode = useContext(SiteContext);
  // Use site-specific logic
}
```

### ❌ DON'T: Navigation Anti-patterns

```typescript
// ❌ Never import Link from next/link for internal app routes
import Link from 'next/link';

// ❌ Don't hardcode site/locale in URLs
<Link href="/main/en/products">Products</Link>

// ❌ Don't read site from env (breaks multi-site)
const site = process.env.SITE_CODE;
```

---

## Routing Architecture

Routes live under `src/app/[site]/[locale]/` in three layout groups: `(default)` (full header/footer), `(reduced)` (checkout), `(no-margin)` (full-width CMS). API routes are under `src/app/api/`.

- Pages are **Server Components** by default; `await params` (it is a `Promise`).
- **Protect pages server-side** — check auth and `redirect(...)` in the Server Component, never with a client `useSession` guard (it flashes content before redirect).
- Add SEO via `generateMetadata` using `getTranslations`.

---

## Layout Architecture

- Root layout `[site]/[locale]/layout.tsx` wires all providers in order: `AuthSessionProvider` → `SiteProvider` → `NextIntlClientProvider` → `StoreProvider`.
- **Every layout** must call `setRequestSite(site)` and `setRequestLocale(locale)` after `await params` so child layouts inherit context.
- Route groups pick the chrome: `(default)` = Header + Footer, `(reduced)` = checkout header, `(no-margin)` = full-width CMS.
- Fetch data in Server Component layouts. Never `'use client'` a layout, fetch via SWR/`fetch('/api/...')` there, or call request-context setters in client code.

---

## Code Patterns

### Server Components (Default)

Use Server Components by default. Only add `'use client'` when the component needs interactivity.

```typescript
// Server Component - no directive needed
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id); // from lib/ssr
  return <ProductDetail product={product} />;
}
```

### Client Components

Only use when component needs hooks, event handlers, or browser APIs:

```typescript
'use client';

export function AddToCartButton({ productId }: Props) {
  const { addItem, loading } = useCart();
  return (
    <Button onClick={() => addItem(productId, 1)} disabled={loading}>
      Add to Cart
    </Button>
  );
}
```

### API Calls Architecture

```
Client Component → lib/client/*.ts → /api/* routes → Platform Services → Integrations (Emporix/SAP/etc.)
Server Component → lib/ssr/*.ts → Platform Services → Integrations (Emporix/SAP/etc.)
```

```typescript
// In Client Components - use lib/client
import { fetchCurrentCart } from '@/lib/client/carts';
// In Server Components - use lib/ssr
import { getCurrentCart } from '@/lib/ssr/carts';
// In API routes - use platform/server
import server from '@/platform/server';

const cartService = server.get<CartService>('CartService');
```

### Platform layer boundaries: Services vs Integrations (mandatory)

The platform split in `src/platform/` must stay strict so HTTP route handlers and SSR helpers do not become second integration layers.

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Integrations** | `src/platform/integrations/**` | Adapters to external systems (`Emporix*Api`, CPI/SAP clients, etc.); vendor or wire-format DTOs and HTTP details. |
| **Services** | `src/platform/services/**` | Domain-facing interfaces; orchestrate integrations, validation, and mapping to **service** models consumed by the app. |

**Rules — avoid layer breaks**

- **`src/app/api/**/route.ts`**: Use `server.get<…>()` only for **services** from `@/platform/services/**` (and acceptable cross-cutting platform services such as `LoggerService`, `SessionService` where already established). **Do not** import from `@/platform/integrations/**`, **do not** resolve `Emporix*Api` or other integration bindings from the route, and **do not** invoke integration-specific mappers (e.g. `Emporix*Mapper`) in the handler. Expose new behavior through the relevant `*Service` API instead.
- **`src/lib/ssr/**`**: Same boundary — use `ssr.get<*Service>('…Service')` for domain data; **do not** call integrations or integration mappers directly.
- **Integrations** are consumed from **service implementations** under `src/platform/services/**/impl/` (and the same architectural layer), not from API routes or `lib/ssr`.

**Anti-pattern:** A route that does `server.get<EmporixReturnApi>(…)` plus `EmporixReturnMapper` to build the JSON response — that orchestration and mapping belongs inside `ReturnService` (or the appropriate domain service), and the route should call only that service.

### Library Structure (`src/lib/`)

| Context | Use | Example |
|---------|-----|--------|
| Client Component | `lib/client/*` | `import { fetchCurrentCart } from '@/lib/client/carts'` |
| Server Component | `lib/ssr/*` | `import { getCurrentCart } from '@/lib/ssr/carts'` |
| API Route | Platform services directly | `server.get<CartService>('CartService')` |
| Middleware | `lib/server/*` | `import { getBaseUrlFromHeaders } from '@/lib/server/url-utils'` |
| Both | `lib/common/*` or root | `import { cn } from '@/lib/utils'` |

### Server data fetching vs client hydration

- **First paint:** Prefer loading domain data in Server Components or `src/lib/ssr/*` via `ssr.get<*Service>()`. Avoid `fetch('/api/…')` from Server Components for internal BFF calls when an SSR helper already exists.
- **Hydration / seeding:** Pass serializable server props (for example `shopSession`, `site`, optional `initialCart`) into client providers or hooks and use them only to **initialize** client stores. **Mutations and refetches** go through `lib/client` → `/api`.
- **Avoid** issuing two independent loads of the same entity on mount unless session or authentication changed.

---

## State Management

### Store Provider Hierarchy (Order Matters!)

The nesting order determines which stores can access data from other stores:

```
SiteStoreContext                  # 1. Root - site configuration
├── ShippingMethodsStoreContext   # 2. Depends on site (countries, currency)
├── ProductStoreContext           # 3. Depends on site (currency, availability)
├── CustomerStoreContext          # 4. Customer data with currency preferences
│   ├── OrderStoreContext         # 5. Depends on customer (logged-in state)
│   └── CartStoreContext          # 6. Depends on customer (logged-in state)
│       └── CheckoutStoreContext  # 7. Depends on cart data
├── HistoryStoreContext           # 8. Browsing behavior tracking
├── DashboardStoreContext         # 9. Dashboard state
├── SessionStoreContext           # 10. Session management
├── NotificationStoreContext      # 11. Notifications
└── AvailabilityStoreContext      # 12. Product availability
```

**CRITICAL**: Stores can only access data from stores that wrap them (higher in hierarchy).

### Hook Pattern

```typescript
// Use domain hooks that wrap stores
import { useCart } from '@/hooks/cart/useCart';
import { useCustomer } from '@/hooks/customer/useCustomer';

// Don't use stores directly in components
```

---

## Dependency Injection

### Using Services

```typescript
// In API routes
import server from '@/platform/server';
const service = server.get<CartService>('CartService');

// In lib/ssr functions
import ssr from '@/platform/ssr';
const service = ssr.get<CartService>('CartService');
```

### Creating Injectable Services

```typescript
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';

@injectable('CartService', 'Singleton')
class EmporixCartService implements CartService {
  constructor(@inject('EmporixCartApi') private cartApi: EmporixCartApi) {}
}
```

After adding/modifying `@injectable` classes, run:

```bash
npm run generate  # Regenerates DI containers
```

---

## Authentication

### Server-Side Protection (Recommended)

```typescript
export default async function AccountPage({ params }: Props) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect({ href: '/login', locale: params.locale });
    return;
  }
  return <AccountDashboard customer={customer} />;
}
```

### Client-Side Session

```typescript
'use client';
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
if (status === 'loading') return <Skeleton />;
```

---

## CSRF Protection

CSRF is automatically handled via `CsrfProvider` in the root layout. All POST/PUT/DELETE/PATCH requests get CSRF tokens automatically.

---

## Testing

### Test Commands

```bash
npm run jest              # Unit/integration tests
npm run e2e               # E2E tests (needs dev server)
npm run test              # Both in parallel
npm run jest:coverage     # With coverage report
```

### Mandatory Local Validation Before Commit/Push

Before any commit or push, every agent/prompt must run and pass all four local gates below. Stop on first failure.

This local policy is a security-focused superset of CI and is intentionally stricter than any single GitHub workflow.

Required local gates are: `npm audit --audit-level=high`, `npm run jest`, `npm run build`, and a SonarQube repository scan. Any failure, missing Sonar credentials, unreachable Sonar host, or Sonar scan failure blocks commit/push.

Default local execution order:

1. `npm audit --audit-level=high`
2. `npm run jest`
3. `npm run build`
4. `SONAR_HOST_URL=https://sonarqube.k8s-tech.emporix.io SONAR_TOKEN="$SONAR_LOGIN" npx --yes sonarqube-scanner -Dsonar.projectKey=emporix-showcase`

Workflow parity details (exact per workflow):

- `.github/workflows/github-actions-deploy-pr-preview.yaml`: `audit -> generate -> lint -> jest`; this workflow does not run `build` or Sonar.
- `.github/workflows/sonarqube-scan.yml`: dedicated Sonar job with checkout `fetch-depth: 0` and pinned action SHA.
- Some deploy workflows use `continue-on-error` for audit; local policy remains blocking.

Sonar equivalence rules:

- The pinned GitHub Action in CI is authoritative for pipeline parity.
- The local scanner is mandatory preflight but not byte-for-byte identical to the GitHub Action runtime.
- Do not claim `sonarqube-scanner@5.0.0` or any local npm package is equivalent to the pinned action SHA.
- Local pinning is optional for reproducibility only.
- Closest local parity requires full git history, the same host, the same project key, and a valid token.

### Test Structure

- **Hook tests**: `src/hooks/**/*.test.tsx` (jsdom + @swc/jest)
- **Component tests**: `src/components/**/*.test.tsx` (node + ts-jest)
- **Platform tests**: `src/platform/**/*.test.ts` (node + ts-jest)
- **E2E tests**: `e2e/*.spec.ts` (Playwright)

### Hook Test Pattern

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { StoreProvider } from '@/providers/StoreProvider';

const wrapper = ({ children }) => <StoreProvider>{children}</StoreProvider>;

test('should fetch cart', async () => {
  const { result } = renderHook(() => useCart(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.cart).toBeDefined();
});
```

---

## Code Quality Standards

### Always

- Use strict TypeScript - no `any` (use `unknown` if uncertain)
- Use explicit return types for functions
- Prefer interfaces over types for object shapes
- Add `'use client'` only when component needs interactivity
- Use `lib/ssr/*` for Server Components, `lib/client/*` for Client Components
- Protect pages in Server Components (redirect), not Client Components
- Call `setRequestSite(site)` and `setRequestLocale(locale)` in layouts
- Use `@/i18n/navigation` utilities for navigation
- Write comments only when they explain _why_, not _what_ — omit comments that merely restate the next line of code
- Define enums, const objects, or named constants for domain values (statuses, error codes, roles, etc.) and reference them instead of inline literals

### Never

- Hardcode site or locale in URLs
- Import `server` or `ssr` containers in client code
- Use `fetch('/api/...')` in Server Components (use lib/ssr)
- Add `'use client'` to entire pages or layouts
- Create stores outside of StoreProvider context
- Add trivial comments that restate what the code already expresses (e.g., `// Get translations`, `// Return success response`, `// Validate required fields`, `// If not found, return undefined`). Comments should explain intent, rationale, or non-obvious behaviour — not narrate code
- Use magic string literals for domain values (statuses, error codes, types, etc.) — always use an enum, const object, or named constant (e.g., `ORDER_STATUS.COMPLETED` instead of `'COMPLETED'`)

### Type-only imports (`import type`)

- **Always use `import type` for symbols that are only used in type positions** (type annotations, generics, `as` casts, interface `extends`, etc.) and never appear as runtime values (constructor calls, `instanceof`, enum member access, function calls).
- This is **especially critical in `'use client'` components**: a regular `import { Cart } from '@/platform/…'` pulls the platform module into the client bundle even though the symbol is only used for typing. `import type { Cart }` is erased at compile time, keeping the client bundle safe and smaller.
- When a single import statement mixes runtime values and type-only symbols, use inline `type` qualifiers:

```typescript
// ✅ DO — type-only import (erased at compile time)
import type { Cart } from '@/platform/services/model/cart';
import type { Product } from '@/platform/services/model/product';

// ✅ DO — mixed import with inline type qualifier
import { ORDER_STATUS, type Order } from '@/platform/services/model/order';

// ❌ DON'T — pulls the module into the runtime bundle unnecessarily
import { Cart } from '@/platform/services/model/cart';
```

- Apply the same rule to **all** type-only imports, not just `@/platform/**` — including third-party libraries, `@/stores/*`, `@/hooks/*`, and any other module.
- When refactoring or reviewing existing code, convert value imports to `import type` where the symbol is type-only.

### Hardcoded fallbacks and TODO

- Whenever you add **any** hardcoded fallback (default literals when config, API, session, or domain data is missing or uncertain — e.g. `|| 'value'`, `?? default`, ternary defaults to constants, empty-object/array stand-ins), **also add a `TODO` comment** on the preceding line or same line stating what should replace it (real source, env, API field, ticket) or that it needs product follow-up.
- Applies to new and changed code; the TODO makes temporary or debatable defaults visible in review and search (`TODO`).

### Async/await over `.then` / `.finally` / `void`-promise patterns

- **Always prefer `async/await` with `try / catch / finally`** whenever you have to wait on a promise, release a resource after it settles, or branch on its outcome. This is the canonical pattern across the project (platform services, lib/client, lib/ssr, hooks, components).
- **Do not** use `.then(...)` / `.catch(...)` / `.finally(...)` chaining when an `async` function body can express the same flow. Do not use the `void promise.finally(reset)` fire-and-forget pattern to reset flags — wrap the awaited call in `try/finally` instead.
- **Fire-and-forget in sync contexts (e.g. `useEffect` bodies, Zustand `subscribe` callbacks, event handlers that can't be `async`)**: declare an `async` helper and invoke it as `void helper();` — do not inline a `.finally(...)` chain.
- **Exceptions** (keep `.then` / `.catch` / `Promise.*`): combinators where `await` loses parallelism (`Promise.all`, `Promise.allSettled`, `Promise.race`), and existing test utilities or library APIs that require a `.then` shape.

```typescript
// ❌ DON'T — void + .finally() to reset a flag / track completion
inFlightRef.current = true;
void doWork(args).finally(() => {
  inFlightRef.current = false;
});

// ❌ DON'T — .then chain for a linear flow
getUser(id).then((user) => {
  enrich(user).then((enriched) => { … });
});

// ✅ DO — async helper with try/finally; caller uses `void helper()` in sync contexts
const runIfNeeded = async () => {
  inFlightRef.current = true;
  try {
    await doWork(args);
  } finally {
    inFlightRef.current = false;
  }
};

void runIfNeeded(); // inside useEffect / subscribe callback

// ✅ DO — async/await for linear flow
const user = await getUser(id);
const enriched = await enrich(user);

// ✅ DO — Promise.all for genuine parallelism
const [a, b] = await Promise.all([loadA(), loadB()]);
```

---

## UI Components

### UI & Figma Guardrails (Mandatory)

When implementing, refactoring, or reviewing UI, treat the Figma design system as the source of truth and reuse existing building blocks before creating anything new.

- **Primary design source**: Figma file `B2B-New-Showcase` (`TYdPJprCUxuqn564qa9urk`).
- **Main style guard node**: [`416:8799` (`I. 𝗔𝗧𝗢𝗠𝗦 ↓`)](https://www.figma.com/design/TYdPJprCUxuqn564qa9urk/B2B-New-Showcase?node-id=416-8799&m=dev) for typography, spacing, radii, colors, and foundational style decisions.
- **Prepared component guard node**: [`416:8800` (`II. Molecules ↓`)](https://www.figma.com/design/TYdPJprCUxuqn564qa9urk/B2B-New-Showcase?node-id=416-8800&m=dev) for reusable composed components and patterns.
- **MCP verification requirement**: For every UI task, use Figma MCP (`get_metadata` and `get_design_context`) for relevant nodes before coding or reviewing UI; do not rely on memory or assumptions.
- **Token-first requirement**: For UI styling, run `get_variable_defs` and map styles to project tokens/CSS variables (or existing component token usage) before introducing literal values.
- **Atoms foundation coverage (mandatory)**: For every Figma-driven UI change, validate and map all applicable Atoms foundations from `I. 𝗔𝗧𝗢𝗠𝗦 ↓`: typography, colors, grid/layout behavior, spacing, icon sizing/usage, border radius, and drop shadows/elevation.
- **Semantic HTML requirement (Atoms-first)**: Use the semantic element that matches the Figma Atoms typography intent. Do not replace heading/text semantics with generic wrappers for convenience.
- **Heading mapping rule**: If Figma specifies `Desktop/heading/h1`..`Desktop/heading/h6`, render real `<h1>`..`<h6>` tags in code. Example: `Desktop/heading/h5` must render as `<h5>`, not `<div>`/`<span>` with heading styles.
- **Heading primitive preference**: Prefer `src/components/ui/h.tsx` primitives (`H1`..`H6`) when implementing Figma `Desktop/heading/*` styles so semantic tags and Atoms typography stay aligned.
- **No redundant typography overrides**: When the chosen semantic heading element (or `H1`..`H6` primitive) already matches Atoms for that level, do not add extra font-size/font-weight/line-height classes. Add typography overrides only when Figma explicitly differs from the default Atoms heading style for that context.
- **No redundant foundation overrides**: If existing component defaults already match Atoms for colors, spacing, grid behavior, icon size, radius, or shadows, do not restyle them again. Add overrides only for explicit Figma differences in that specific context.
- **Reuse-first requirement**: Always check existing components in `src/components/ui/` and domain folders, and extend/compose them before introducing new primitives or bespoke patterns.
- **No hardcoded UI literals**: Avoid raw hex colors, one-off pixel spacing, or custom font literals when a Figma/project token exists.

### shadcn/ui Components

Base components live in `src/components/ui/` (`import { Button } from '@/components/ui/button'`). Use the **shadcn MCP server** to browse, search, or install new components. Style with Tailwind utility classes, never inline `style={{...}}`.

---

## Logging

**CRITICAL: Never use `console.log`, `console.warn`, `console.error`, or any other `console.*` method in application code. Always use the Pino-based `LoggerService`.**

### How to Access the Logger

| Context                       | How to get the logger                                    | Import                                                       |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| **API routes**                | `server.get<LoggerService>('LoggerService')`             | `import server from '@/platform/server'`                     |
| **Server Components / SSR**   | `ssr.get<LoggerService>('LoggerService')`                | `import ssr from '@/platform/ssr'`                           |
| **Platform services (DI)**    | `@inject('LoggerService') private logger: LoggerService` | inversify `@inject`                                          |
| **React components**          | `const logger = useLogger()`                             | `import { useLogger } from '@/hooks/common/useLogger'`       |
| **Client utilities / stores** | `const logger = getLogger()`                             | `import { getLogger } from '@/lib/logger/use-logger-client'` |

### Do / Don't

```typescript
// ✅ DO — API route
import { useLogger } from '@/hooks/common/useLogger';
// ✅ DO — Client utility / store
import { getLogger } from '@/lib/logger/use-logger-client';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET() {
  const logger = server.get<LoggerService>('LoggerService');
  logger.info({ route: '/api/example' }, 'Request received');
}

// ✅ DO — Client component
('use client');

export function MyComponent() {
  const logger = useLogger();
  logger.error({ error: err.message }, 'Something failed');
}

export async function fetchData() {
  const logger = getLogger();
  logger.debug({ url }, 'Fetching data');
}

// ✅ DO — context first, message second (Pino native order)
logger.error({ error: err.message }, 'Operation failed');

// ❌ DON'T — Never use console.* in application code
console.log('debug info');
console.error('failed');
console.warn('something wrong');

// ❌ DON'T — message first, context second (wrong order)
logger.error('Operation failed', { error: err.message });
```

**Exception:** `console.*` is acceptable in:

- Test files (`*.test.ts`, `*.test.tsx`)
- One-off scripts in `scripts/` directory
- `ApiDebugPanel.tsx` (intentionally logs to browser DevTools)

### Logging in Edge-only modules

- Use **`LoggerService` / `getLogger()` / `useLogger()`** for all normal application logging; never `console.*` in API routes, platform services, `lib/client`, or React components for operational logs.
- **Exception:** Next.js **Edge** middleware and Edge-adjacent helpers cannot use Pino. Use **`edgeLog`** from `@/lib/server/edge-stderr-log` in `src/site/middleware.ts`, `src/caching/cache-middleware.ts`, and similar Edge-only entrypoints. Emit **structured JSON** (event name + safe fields only); do not log secrets, tokens, or PII.

### API Debug Tooling (Dev Only)

A dual-output debug system logs upstream API calls to the server terminal and the browser console, controlled by `NEXT_PUBLIC_DEBUG_API_*` and `NEXT_DEBUG_API_PAYLOAD` env vars. See [docs/logging-guide.md](../../docs/logging-guide.md) for the full reference.

---

## Development Commands

```bash
npm run dev              # Start dev server with auto-generation, use it for mostly for local development and track terminal as it is providing live errors and warnings without manual rebuilds
npm run build            # Production build
npm run generate         # Regenerate DI containers
npm run lint             # Run ESLint
npm run format           # Format with Prettier
```

---

## Key Architectural Decisions

1. **Server-First**: Server Components by default for performance
2. **Type Safety**: Strict TypeScript throughout
3. **Dependency Injection**: Inversify for testable services
4. **Multi-Tenancy**: Site-aware routing and configuration
5. **Internationalization**: Locale-aware with next-intl
6. **Security**: CSRF, session validation, input validation

---

## Common Tasks

### Adding a New Page

1. Create page at `src/app/[site]/[locale]/(default)/new-page/page.tsx`
2. Set request context with `setRequestSite` and `setRequestLocale`
3. Use `lib/ssr` functions for data fetching
4. Generate metadata with `generateMetadata`

### Adding a New API Route

1. Create route at `src/app/api/domain/route.ts`
2. Get services via `server.get<Service>('ServiceName')`
3. Validate session if needed
4. Use `LoggerService` for structured logging

### Adding a New Hook

1. Create hook in `src/hooks/domain/useHook.ts`
2. Use store via `useStoreContext()` hook
3. Return clean typed interface
4. Handle loading/error states

### Adding a New Injectable Service

1. Create service in `src/platform/services/domain/impl/`
2. Use `@injectable('ServiceName', 'Singleton')` decorator
3. Run `npm run generate` to update containers
4. Commit generated `server.ts` and `ssr.ts` files

### Adding Translations

Translation files are organized by namespace in `src/i18n/translations/{locale}/{namespace}/index.json`.

**Rule**: When using `useTranslations('namespace')`, add translations to the corresponding namespace file:

```typescript
// Component uses:
const t = useTranslations('orders');
// ✅ Add translations to: src/i18n/translations/en/orders/index.json

// Component uses:
const t = useTranslations('account.returns');
// ✅ Add translations to: src/i18n/translations/en/account/index.json under "returns" key
```

**Never** add translations directly to the main aggregated `en.json` or `de.json` files - always use the namespace-specific files.

**Namespace structure**:

- Top-level namespace: `useTranslations('orders')` → `orders/index.json`
- Nested namespace: `useTranslations('account.returns')` → `account/index.json` → `returns: { ... }`
