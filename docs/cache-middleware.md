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
  - includes `s-maxage=<revalidate>` and `stale-while-revalidate=<2x revalidate>`
- **`X-Cache-Tags`**
  - tags after capture group substitution

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
