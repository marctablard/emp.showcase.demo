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
NEXT_CACHE_DEFAULT_REVALIDATE=3600
```

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
