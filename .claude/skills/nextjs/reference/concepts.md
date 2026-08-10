# Next.js — Core Concepts (condensed)

Mental model for the App Router (Next.js 15/16). Each section links to the canonical doc page for full detail.

## Routing — file-system based

Routes are defined by folders inside `app/`. A folder becomes a route segment; a `page.js`/`page.tsx` makes it publicly accessible.

Special files (App Router):

| File | Role |
|------|------|
| `layout.js` | Shared UI that wraps children; **preserves state**, does not re-render on navigation. Root layout (`app/layout.tsx`) is required and must render `<html>`/`<body>`. |
| `page.js` | Unique UI of a route; makes the segment routable. |
| `loading.js` | Instant loading UI via React Suspense while the segment streams. |
| `error.js` | Error boundary (Client Component) for a segment; gets `error` + `reset`. |
| `global-error.js` | Catches errors in the root layout. |
| `not-found.js` | UI for `notFound()` and unmatched URLs. |
| `template.js` | Like layout but **re-mounts** on navigation (fresh state). |
| `default.js` | Fallback for unmatched parallel-route slots. |
| `route.js` | API endpoint (Route Handler) — exports `GET`, `POST`, etc. |
| `forbidden.js` / `unauthorized.js` | UI for `forbidden()` / `unauthorized()` (auth interrupts). |

Segment naming:
- `[id]` — dynamic segment (`params.id`).
- `[...slug]` — catch-all. `[[...slug]]` — optional catch-all.
- `(group)` — route group: organize without affecting the URL.
- `@slot` — named slot for **parallel routes** (render multiple pages in one layout).
- `(.)`, `(..)`, `(...)` — **intercepting routes** (e.g. modal over a route).

Docs: [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) · [Dynamic Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) · [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) · [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)

## Server vs Client Components

- **Server Components are the default.** They run only on the server, can be `async`, can fetch data directly, access secrets, and never ship to the client. They cannot use state/effects or browser APIs.
- **Client Components** opt in with `'use client'` at the top of the file. They can use `useState`, `useEffect`, event handlers, browser APIs. The directive marks a boundary — everything imported into it becomes client code.
- Pass Server → Client data via **serializable props** only. Pass Server Components into Client Components as `children` to keep them on the server.
- Keep `'use client'` low in the tree; fetch data on the server and hand it down.

Docs: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · [`use client`](https://nextjs.org/docs/app/api-reference/directives/use-client) · [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server)

## Rendering strategies

- **Static (default)** — rendered at build time, cached and reused (SSG-like). Best performance.
- **Dynamic** — rendered per-request. Triggered by using request data (`cookies()`, `headers()`, `searchParams`, uncached `fetch`, `connection()`).
- **Streaming** — send UI in chunks with Suspense / `loading.js` so slow parts don't block the page.
- **Partial Prerendering (PPR)** — a static shell with dynamic holes streamed in; combines static speed with dynamic data. Tied to Cache Components.

Docs: [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) · [Streaming](https://nextjs.org/docs/app/guides/streaming)

## Data fetching

- In Server Components, just `await fetch(...)` or call your DB/ORM directly inside an `async` component.
- **As of v15, `fetch` is NOT cached by default.** Opt in per request with `fetch(url, { cache: 'force-cache' })` or time-based `{ next: { revalidate: 60 } }`, and tag with `{ next: { tags: ['x'] } }`.
- For Client Components use a library (SWR, React Query) or Route Handlers.
- Fetch in parallel (`Promise.all`) to avoid request waterfalls; use Suspense to stream independent data.

Docs: [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) · [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch)

## Caching & revalidation

Next.js has several cache layers: the **Data Cache** (fetch results), the **Full Route Cache** (rendered routes), the **Router Cache** (client-side), and the **Request Memoization** (per-render dedupe).

Modern model — **Cache Components / `use cache`** (v15/16):
- `'use cache'` directive marks a function/component/file as cacheable.
- `cacheLife(profile)` sets the revalidation window; `cacheTag(tag)` tags an entry.
- `updateTag(tag)` / `revalidateTag(tag)` / `revalidatePath(path)` invalidate.
- Enable with `cacheComponents: true` in `next.config.js`.

Variants: [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) · [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private) · [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)

Docs: [Caching](https://nextjs.org/docs/app/getting-started/caching) · [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) · [How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works) · [Previous caching model](https://nextjs.org/docs/app/guides/caching-without-cache-components)

## Mutating data — Server Actions

- Async functions marked `'use server'`. Call them from forms (`<form action={fn}>`) or event handlers in Client Components.
- Inside an action: validate input, write to your data source, then `revalidatePath`/`revalidateTag` or `redirect`.
- Server Actions are the recommended way to mutate without writing a separate API route.

Docs: [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) · [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) · [Forms](https://nextjs.org/docs/app/guides/forms)

## Async request APIs (v15+)

These are **async — you must `await`** them, and they only work in dynamic contexts:

```ts
import { cookies, headers, draftMode } from 'next/headers'
const cookieStore = await cookies()
const headerList = await headers()
```

`params` and `searchParams` passed to pages/layouts are now Promises too:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

Docs: [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) · [`headers`](https://nextjs.org/docs/app/api-reference/functions/headers) · [`params`/`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page)

## Navigation

- `<Link href>` for client-side navigation with automatic prefetching.
- Programmatic: `useRouter()` (`push`, `replace`, `refresh`, `back`) — from `next/navigation` in App Router.
- Read state: `usePathname()`, `useSearchParams()`, `useParams()`.
- Server-side redirects: `redirect()`, `permanentRedirect()`.

Docs: [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) · [Link](https://nextjs.org/docs/app/api-reference/components/link) · [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router)

## Proxy (formerly Middleware)

Renamed from `middleware.ts` to **`proxy.ts`** in v16. Runs before a request completes — use for auth gating, redirects, rewrites, header manipulation. Export a `proxy` function and optional `config.matcher`.

Docs: [Proxy](https://nextjs.org/docs/app/getting-started/proxy) · [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

## Metadata & SEO

- Static: export a `metadata` object from `layout`/`page`.
- Dynamic: export `async function generateMetadata()`.
- File-based: `favicon.ico`, `opengraph-image`, `sitemap.(xml|ts)`, `robots.(txt|ts)`, `manifest.(json|ts)`.
- OG images at runtime via `ImageResponse` (`next/og`).

Docs: [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) · [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) · [Metadata Files](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)

## Optimization

- **Images** — `next/image` (`<Image>`): automatic sizing, lazy loading, modern formats. Configure remote patterns in `next.config.js`.
- **Fonts** — `next/font`: self-hosted, zero layout shift, no external requests.
- **Scripts** — `next/script` with `strategy` (`beforeInteractive`, `afterInteractive`, `lazyOnload`).
- **Bundling** — `optimizePackageImports`, `serverExternalPackages`, lazy loading via `next/dynamic`.

Docs: [Images](https://nextjs.org/docs/app/getting-started/images) · [Fonts](https://nextjs.org/docs/app/getting-started/fonts) · [Script](https://nextjs.org/docs/app/api-reference/components/script) · [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)

## Route Handlers (API)

`route.ts` exports HTTP-method functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) that receive a `NextRequest` and return a `Response`/`NextResponse`. The App Router equivalent of Pages Router API Routes.

Docs: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) · [`NextResponse`](https://nextjs.org/docs/app/api-reference/functions/next-response)

## Error handling

- `error.js` (segment boundary) and `global-error.js` (root) catch render errors.
- Trigger states with `notFound()`, `forbidden()`, `unauthorized()`, `redirect()`.
- `not-found.js`, `forbidden.js`, `unauthorized.js` render the corresponding UI.

Docs: [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) · [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)

## Runtimes

- **Node.js runtime** (default) — full Node APIs; use for most work.
- **Edge runtime** — lightweight, limited APIs, low latency; opt in with `export const runtime = 'edge'`.

Docs: [Edge Runtime](https://nextjs.org/docs/app/api-reference/edge) · [`runtime` segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)

## Deployment

- Vercel is the zero-config target; `output: 'standalone'` for containers; `output: 'export'` for fully static sites.
- Self-hosting and platform guides cover Docker, Node servers, CDNs.

Docs: [Deploying](https://nextjs.org/docs/app/getting-started/deploying) · [Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting) · [Static Exports](https://nextjs.org/docs/app/guides/static-exports)
