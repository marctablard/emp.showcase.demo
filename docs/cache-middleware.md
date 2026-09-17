# Cache Middleware

Centralized place to apply `Cache-Control` and cache tags based on URL patterns.

This avoids sprinkling `export const revalidate` / `export const dynamic` across pages and API routes.

## What exists where

- **`src/caching/cache-config.ts`**
  - Declarative cache rules (pattern → revalidate/tags)
- **`src/caching/cache-middleware.ts`**
  - Applies the matching rule and sets headers
- **`src/proxy.ts`**
  - Calls the cache middleware as part of request handling

## Enable / disable

```bash
NEXT_CACHE_MIDDLEWARE_ENABLED=true
NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE=3600
```

### `NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE`

Default revalidation window in **seconds**. Fallback is `3600`. Non-positive or non-numeric values fall back to `3600`. Consumed in two places:

- **HTTP cache middleware** — `DEFAULT_CACHE_REVALIDATE` in `src/caching/cache-config.ts`. Used as the default `s-maxage` when a matching rule does not set `cache.revalidate` explicitly.
- **Emporix `authenticatedFetch` opt-in caching** — `DEFAULT_CACHE_REVALIDATE` in `src/platform/integrations/emporix/common/cache-defaults.ts`. Passed as the trailing `cacheSeconds` argument from reference/catalog GET callers (currency, country, catalog, category, brand, label, product GET, site settings, shipping, availability, payment gateway frontend, etc.). Applies only to GET/HEAD and only when the caller has not set `options.cache` / `options.next` explicitly; write methods are always forced to `cache: 'no-store'`.

Both layers read the same env so a single setting controls the default revalidation window across the app. The integration module keeps its own parse of the env (and does not import from `src/caching/**`) to preserve the platform / caching layer boundary.

The `NEXT_PUBLIC_` prefix is required because the integration module can be evaluated from the client DI container graph; Next.js only inlines `NEXT_PUBLIC_*` env vars into the browser bundle, so a non-public name would resolve to `undefined` on the client and the override would be silently lost.

## Rule shape

Rules live in `src/caching/cache-config.ts`.

```ts
export const cacheRules: CacheRule[] = [
  {
    url: '/product/(.*)',
    cache: {
      revalidate: 3600,
      tags: ['product-$1'],
    },
  },
];
```

### Properties

- **`url`**
  - Regex (string) matched against the request pathname
- **`cache.revalidate`**
  - Seconds used for `s-maxage` (and related directives)
- **`cache.tags`**
  - Array of tag strings written to `X-Cache-Tags`
  - Supports capture groups via `$1`, `$2`, …

### Matching

- Rules are evaluated top-to-bottom
- First match wins
- No match → middleware leaves the response unchanged

## What the middleware sets

- **`Cache-Control`**
  - when `revalidate` is positive: `public, max-age=<revalidate>, s-maxage=<revalidate>` and `stale-while-revalidate=<2x revalidate>`
  - when `revalidate` is `0` or negative: `private, no-store` (no `s-maxage`, no SWR)
  - for authenticated requests: always `private, no-store` (see below)
- **`X-Cache-Tags`**
  - tags after capture group substitution
  - never set for authenticated requests

### Authenticated requests bypass

Responses for logged-in customers can be personalised (customer-segment scoped catalog, PDP, search suggestions — see [Search Service — Customer segments & products mode](./search-service.md#customer-segments--products-mode-cop-4822), COP-4822). A cache rule such as `/product/(.*)` would otherwise override route-level headers and mark them `public`.

`hasAuthSession(req)` in `src/caching/cache-middleware.ts` therefore checks `NextRequest.cookies` for the Auth.js v5 default session cookie name (`src/auth/auth.config.ts` sets no custom name). A cookie matches only when its name is exactly `authjs.session-token`, the HTTPS form `__Secure-authjs.session-token`, or a numeric chunk of either (`authjs.session-token.0`, `__Secure-authjs.session-token.1`, …) via `isAuthJsSessionCookieName`. Names that merely contain that fragment (for example `xauthjs.session-token` or `authjs.session-token-old`) are ignored so anonymous traffic stays cacheable. When a match is present and a rule matches:

- `Cache-Control` is forced to `private, no-store` regardless of the rule's `revalidate`
- no `X-Cache-Tags` header is emitted

Anonymous requests are unaffected. Rules that do not match still leave the response unchanged, so API routes that set `Cache-Control: private, no-store` themselves (for example `/api/search` in `assigned` mode) keep their own header.

## Examples

### Product pages

```ts
{
  url: '/product/(.*)',
  cache: {
    revalidate: 3600,
    tags: ['product-$1'],
  },
}
```

### Product catalog API

Catalog JSON (`/api/products/(.*)`) is `revalidate: 0` so the middleware emits `private, no-store` (no `s-maxage=3600`, no SWR 7200). Variants and availability under that catch-all inherit no-store.

The more specific `/api/products/(.*)/price` rule stays `revalidate: 0` (no-store) and is listed **before** the catch-all so first-match still applies to Price Service.

```ts
{
  url: '/api/products/(.*)/price',
  cache: {
    revalidate: 0,
    tags: [],
  },
},
{
  url: '/api/products/(.*)',
  cache: {
    revalidate: 0,
    tags: ['product-$1'],
  },
},
```

This HTTP no-store on catalog JSON is independent of `DEFAULT_CACHE_REVALIDATE` / Emporix Product GET Data Cache.

### Browse API

```ts
{
  url: '/api/browse(.*)',
  cache: {
    revalidate: 1800,
    tags: ['browse'],
  },
}
```

## Revalidation

Tags are intended to be used with Next’s revalidation:

```ts
import { revalidateTag } from 'next/cache';

revalidateTag('product-123');
```

## Related files

- `src/caching/cache-config.ts`
- `src/caching/cache-middleware.ts`
- `src/proxy.ts`
- `.env.template`

## Related Documentation

- [Documentation index](./README.md)
- [Rendering: SSR / SSG / ISR](./rendering-ssr-ssg-isr.md)
- [Site Middleware](./site-middleware.md)
- [Deployment Process](./deployment-process.md)
