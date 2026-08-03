---
name: nextjs
description: Comprehensive Next.js reference and documentation index (App Router + Pages Router, Next.js 15/16). Covers getting started, routing, rendering, RSC, data fetching, caching ('use cache' / Cache Components), mutations & Server Actions, metadata, optimization, deployment, full API reference (directives, components, file conventions, functions, next.config.js, CLI, adapters, Edge runtime, Turbopack), guides and migration. Use when writing, reviewing, configuring, debugging or explaining Next.js code, or when you need the canonical doc URL for any Next.js feature.
---

# Next.js

A complete, navigable index of the official Next.js documentation (`https://nextjs.org/docs`) plus condensed explanations of the core concepts. Reflects **Next.js 16** (App Router as default; Pages Router still supported as legacy).

## How to use this skill

1. **Need a concept refresher?** Read [reference/concepts.md](reference/concepts.md) — the mental model for routing, rendering, RSC, caching, data fetching and mutations.
2. **Need the canonical doc page for a specific feature?** Use the table of contents:
   - App Router (default, recommended): [reference/toc-app-router.md](reference/toc-app-router.md)
   - Pages Router (legacy): [reference/toc-pages-router.md](reference/toc-pages-router.md)
3. **Fetch the live page** with the URL from the TOC when you need exact, current API details. Every doc page also exists as Markdown — append `.md` or fetch `<page-url>` directly. The whole site is machine-readable via `https://nextjs.org/docs/llms.txt` (App Router) and `https://nextjs.org/docs/pages/llms.txt` (Pages Router).
4. **Best-practice rules** for writing/reviewing code live in the companion `next-best-practices` skill — prefer it for "is this idiomatic?" questions.

## Which router?

- **App Router** (`app/`): default since Next.js 13.4, recommended for all new projects. React Server Components, layouts, streaming, Server Actions, `use cache`. This is where the docs effort is focused.
- **Pages Router** (`pages/`): the original model (`getStaticProps`, `getServerSideProps`, API Routes). Still fully supported; both routers can coexist in one app.

## Version landmarks (what changed recently)

- **v16**: `middleware.ts` → **`proxy.ts`** (renamed); Cache Components & `use cache` stabilising; Turbopack as the default bundler; React 19. See [Upgrading to v16](https://nextjs.org/docs/app/guides/upgrading/version-16).
- **v15**: async request APIs — `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` are now **async** (await them). React 19 support, caching defaults changed (fetch no longer cached by default). See [Upgrading to v15](https://nextjs.org/docs/app/guides/upgrading/version-15).
- **v14**: Server Actions stable, Partial Prerendering (preview).

## Top-level documentation map

| Area | What it covers | TOC |
|------|----------------|-----|
| **Getting Started** | Install, project structure, layouts/pages, navigation, Server/Client Components, data fetching, mutating, caching, revalidating, error handling, CSS, images, fonts, metadata, route handlers, proxy, deploying, upgrading | [App](reference/toc-app-router.md#getting-started) · [Pages](reference/toc-pages-router.md#getting-started) |
| **Guides** | Task-oriented how-tos: auth, forms, ISR, i18n, testing, MDX, CSP, self-hosting, migration, PWAs, streaming, prefetching, debugging, MCP server, AI agents… | [App](reference/toc-app-router.md#guides) · [Pages](reference/toc-pages-router.md#guides) |
| **Building Your Application** *(Pages only)* | Routing, rendering (SSR/SSG/CSR/ISR), data fetching, configuring | [Pages](reference/toc-pages-router.md#building-your-application) |
| **API Reference** | Directives, components, file conventions, functions, `next.config.js`, CLI, adapters, Edge runtime, Turbopack | [App](reference/toc-app-router.md#api-reference) · [Pages](reference/toc-pages-router.md#api-reference) |
| **Architecture** | Accessibility, Fast Refresh, Next.js Compiler, Supported Browsers | [App](reference/toc-app-router.md#architecture) |
| **Community** | Contribution guide, Rspack | [App](reference/toc-app-router.md#community) |

## Quick start

```bash
npx create-next-app@latest        # scaffold (App Router by default)
npm run dev                        # dev server (Turbopack) at http://localhost:3000
npm run build && npm run start     # production build + serve
```

Minimal App Router page (`app/page.tsx`):

```tsx
export default function Home() {
  return <h1>Hello Next.js</h1>
}
```

See [reference/concepts.md](reference/concepts.md) for the full mental model and [reference/toc-app-router.md](reference/toc-app-router.md) for every doc page with its URL.
