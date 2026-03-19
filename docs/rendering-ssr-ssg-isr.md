# Rendering: SSR vs SSG vs ISR (Emporix Showcase)

This project is built with **Next.js App Router**. How a route is rendered (server-side per request vs statically at build time vs incrementally) has a big impact on:

- performance and TTFB
- cacheability (CDN / edge)
- what data sources you are allowed to read (headers/cookies)
- SEO and initial page load behavior

This document describes the rendering options we use and what to take into account in this codebase.

## Terminology

### SSR (Server-Side Rendering)

- HTML is rendered **for every request**.
- You can render personalized pages because request-specific data is available.

In App Router, SSR typically happens when:

- you read request-specific data (cookies/headers)
- you set `export const dynamic = 'force-dynamic'`
- or your data fetching is otherwise not statically renderable

### SSG (Static Site Generation)

- HTML is rendered **at build time**.
- Great for SEO + speed and enables aggressive caching.

In App Router, SSG is typically enabled by:

- using `generateStaticParams()` for dynamic routes (e.g. `/product/[id]`) to pre-render a known set of params
- avoiding request-specific reads (headers/cookies)

### ISR (Incremental Static Regeneration)

Next.js uses **ISR** to update previously generated static pages over time.

In App Router, you typically express ISR with:

- `export const revalidate = <seconds>` on a route segment

This is sometimes called **ISG** (Incremental Static Generation). In practice in this project: treat it as ISR.

## Project guidelines (important)

### 1) Avoid reading headers/cookies when you want SSG/ISR

If a page should be statically renderable (SSG/ISR), **do not** make it depend on request-specific state.

Avoid (in server components / layouts / metadata):

- `cookies()` / `headers()`
- reading auth/session cookies
- using APIs that implicitly depend on the request context

Reason:

- reading headers/cookies makes the route dynamic, preventing static rendering and often reducing cacheability.

If you need personalization:

- prefer SSR for that route (`dynamic = 'force-dynamic'`)
- or split the route into:
  - a static shell (SSG/ISR)
  - a small client component that fetches user-specific data

In this project, this is one of the reasons we created an **authenticated variant** of the product page: the public product route can stay statically renderable/cacheable, while authenticated users are rewritten in middleware to the authenticated variant where request-specific data (e.g. prices/customer-specific information) can be handled without breaking SSG/ISR for the public route.

### 2) Provide as much data as possible up front

For best UX and performance, prefer to render the initial view with server-fetched data rather than relying on client-side requests after hydration.

- The initial page should already include the core data needed for the first screen.
- Use client-side requests only for secondary/optional data or post-interaction updates.

In this codebase, server-side data fetching is commonly done via SSR utilities under `src/lib/ssr/*`.

### 3) Use `revalidate` to enable ISR

When a route can be static but should not be “forever static”, use:

- `export const revalidate = <seconds>`

Behavior (high level):

- The page is served from cache when fresh.
- When stale, a request triggers regeneration in the background (depending on runtime / cache layer), and users get updated HTML afterwards.

Keep in mind:

- You must still follow the “no headers/cookies” rule if you want the route to remain statically renderable.
- Pick a `revalidate` interval based on how often the underlying data changes (product pages vs marketing pages vs account pages).

### 4) `generateStaticParams()` is an SSG tool

`generateStaticParams()` is **build-time**.

Use it to pre-render a limited set of pages that are important for SEO/performance.

Example in this project:

- `src/app/[site]/[locale]/(default)/product/[id]/page.tsx`
  - uses `generateStaticParams()` to generate a subset of product IDs
  - controlled by `NEXT_SSG_PRODUCT_COUNT`
  - if `NEXT_SSG_PRODUCT_COUNT <= 0`, it returns `[]` (effectively disabling SSG for that route)

Caution:

- Don’t generate millions of params. Keep the set bounded.
- Avoid per-param heavy work inside `generateStaticParams()`; fetch only what you need to determine the params.

## Caching behavior in this project

### Segment-level config (Next.js)

Next.js segment config is still valid and often the clearest choice:

- `export const revalidate = <seconds>` for ISR
- `export const dynamic = 'force-dynamic'` to force SSR

### Cache middleware overrides

We also have a centralized cache layer that can apply `Cache-Control` and cache tags based on URL patterns.

Use this when:

- you need to override caching behavior without changing many routes
- you want consistent cache headers for groups of routes
- you want URL-derived cache tags

Reference:

- `docs/cache-middleware.md`

Important:

- The cache middleware affects response headers/caching at the proxy/middleware layer.
- It does **not** turn an SSR route into SSG. Rendering mode is determined by Next.js and by whether the route is static/dynamic.

## Practical decision matrix

- If it’s **public**, SEO-relevant, and not personalized:
  - Prefer **SSG + ISR** (`generateStaticParams()` + `revalidate`)
- If it’s **public**, not easily enumerable, but still cacheable:
  - Prefer **ISR** (`revalidate`) without `generateStaticParams()`
- If it’s **personalized** (account, cart, approvals):
  - Prefer **SSR** (`dynamic = 'force-dynamic'`) and keep caching conservative

## What to check during implementation/review

- Are we accidentally reading cookies/headers in a route intended to be static?
- Is the first screen fully renderable without client-side fetching?
- Does `revalidate` match the expected content update frequency?
- If using `generateStaticParams()`, is the param set bounded and build-time safe?
- Do we need a cache middleware rule override for this URL pattern?
