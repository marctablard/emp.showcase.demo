# CMS Framework

This document describes how the storefront integrates content-management
providers. It explains the central-renderer architecture, how a page is
resolved and rendered at request time, the three shipped adapters, and a
step-by-step tutorial for adding a new provider.

For the underlying architectural decisions see:

- [ADR 0001 — CMS providers are integrated solely through adapters](./adr/0001-cms-providers-integrated-solely-through-adapters.md)
- [ADR 0002 — CMS components are co-located and schema-first](./adr/0002-cms-component-co-location-and-schema-first.md)

## Table of contents

1. [Central-renderer architecture](#central-renderer-architecture)
2. [Request-time resolution: `getCmsService()`](#request-time-resolution-getcmsservice)
3. [The adapter trio](#the-adapter-trio)
4. [Provider resolution](#provider-resolution)
5. [How to add a new CMS provider](#how-to-add-a-new-cms-provider)
6. [Component pattern](#component-pattern)
7. [Rich-text AST scope](#rich-text-ast-scope)

## Central-renderer architecture

The storefront is CMS-agnostic. No provider SDK is referenced by the
application core (the page shell, the renderer, the component map, or the
`CMSService` facade). A provider is integrated as a single **adapter** that
implements the `CmsAdapter` SPI (`src/platform/services/cms/CmsAdapter.d.ts`):

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

An adapter is a **pure data translator**: it fetches from its provider and
maps the provider-specific wire format into the agnostic `CMSPage` domain
model through a dedicated mapper. An adapter contains **no render code**.

The request-time data flow is identical for every provider — only the leftmost
box is provider-specific:

```
┌─────────────────────┐   getPage()   ┌──────────────┐   walks body[]   ┌──────────────────┐
│  <Provider>Adapter   │ ────────────► │   CMSPage     │ ───────────────► │   CmsRenderer    │
│  + <Provider>Mapper  │  (wire→CMSPage)│ (agnostic AST)│                  │  + cmsComponentMap│
└─────────────────────┘               └──────────────┘                  └──────────────────┘
   provider-specific                     shared, agnostic                    shared, agnostic
        ▲                                                                          │
        │ optional SPI (getEditableProps / BridgeScript) ──────────────────────────┘
        │ provider editing concerns only — never application code
```

A new provider adds only the leftmost box. Everything to its right is shared
and untouched (ADR 0001).

Rendering is done once, centrally, for every provider:

- The page-route shell `CmsPage` (`src/components/cms/_core/cms-page.tsx`)
  resolves the active `CMSService`, calls `getPage(slug, locale, site)`, and
  maps the returned `page.components[]` to `<CmsRenderer component={...} />`.
  It handles the `{ notfound: true }` result by calling Next's `notFound()`
  (or rendering an empty spacer when `emptyOnNoResult` is set).
- The central `CmsRenderer` (`src/components/cms/_core/cms-renderer.tsx`)
  looks each component up in `cmsComponentMap` by its `type` discriminator
  and renders it. Container components (`page`, `segment`, `columns`, `grid`)
  carry a nested component array; the renderer resolves each child
  recursively and passes the resolved nodes via React `children`. An unknown
  discriminator renders `null` — defence-in-depth, since adapters validate
  upstream against the per-component Zod schemas.

Neither the shell nor the renderer imports from `@/platform/integrations/*`
or from a provider SDK. This is enforced as code: the drift-guard test
`src/components/cms/_core/renderer-provider-agnostic.drift.test.ts` fails the
build if that boundary is ever crossed (see ADR 0001).

A provider-specific concern such as Storyblok's Visual-Editor outline flows
through the **optional** SPI surface, never through application code:
`getEditableProps()` returns plain `data-blok-*` DOM attributes and
`BridgeScript` is a component mounted once in the layout. An adapter that
needs neither simply omits both; the `DelegatingCmsServiceSSR` facade falls
back to `{}` / `null`.

## Request-time resolution: `getCmsService()`

The render path obtains its `CMSService` through
`getCmsService()` (`src/platform/services/cms/get-cms-service.ts`) rather than
resolving the DI container directly. The helper is `import 'server-only'` — it
must never reach a Client Component or the client bundle.

```ts
const cmsService = await getCmsService();
const page = await cmsService.getPage(slug, locale, site);
```

Why the helper exists instead of trusting `instrumentation.ts`: Next.js /
Turbopack can evaluate the `@/platform/ssr` module under separate module
graphs (the server-instrumentation graph vs. the Server-Component render
graph). When that happens, the `CmsAdapter` alias bound at bootstrap by
`instrumentation.ts` lives on the instrumentation-graph container and is
invisible to the render-graph container. A direct render-time
`container.get('CMSService')` would then resolve a fresh
`DelegatingCmsServiceSSR` whose `@inject('CmsAdapter')` finds nothing bound,
and Inversify would throw `No bindings found for service: "CmsAdapter"`.

`getCmsService()` resolves the SSR container at the call site and lazily binds
the `CmsAdapter` alias on **that** container instance (one `isBound` check plus
at most one idempotent rebind, since the resolved adapter is a Singleton). If
the env-resolved target `CmsAdapter:<id>` is not bound on this container, it
falls back to `CmsAdapter:none` so the app still boots on a partially
configured container. The `instrumentation.ts` alias remains as the
server-container / Route-Handler path; this helper is the render-path safety
net. See ADR 0001 and the helper's own JSDoc for the full rationale.

This caveat generalises: any future programmatic DI alias bound in
`instrumentation.ts` must ship an equivalent lazy-bind helper.

## The adapter trio

Three adapters ship today. Each is bound in the DI container with the id
`CmsAdapter:<provider-id>`.

| Provider id | Adapter | Location | Behaviour |
| --- | --- | --- | --- |
| `storyblok` | `StoryblokCmsAdapter` | `src/platform/integrations/storyblok/cms/impl/` | Fetches from the Storyblok Delivery API and maps the story payload (TipTap rich-text + blok body) into `CMSPage` via `StoryblokCmsMapper`. Implements the optional surface: `getEditableProps()` (`data-blok-*`) and `BridgeScript` (`StoryblokBridgeScript`). |
| `local` | `LocalJsonCmsAdapter` | `src/platform/integrations/local/cms/impl/` | Reads version-controlled JSON fixtures under `src/data/cms/`. See [local-cms.md](./local-cms.md). |
| `none` | `NullCmsAdapter` | `src/platform/services/cms/impl/` | Default fallback. Every accessor resolves to `{ notfound: true }` and `hasContent()` returns `false`. Lets the app boot green with no CMS provider configured. |

## Provider resolution

The active provider is resolved from runtime environment variables by
`resolveCmsProvider(env)` (`src/platform/services/cms/CmsProviderResolver.ts`).
The known ids are the typed tuple `CMS_PROVIDER_IDS = ['storyblok', 'local', 'none']`,
which is the single source of truth for both the `CmsProviderId` union and the
runtime guard.

Resolution rules:

- If `NEXT_CMS_PROVIDER` is explicitly set to one of the known ids
  (after trimming), that value wins.
- Otherwise auto-resolve: if `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` is non-empty,
  return `storyblok`; else return `none`.
- Unknown or whitespace-only `NEXT_CMS_PROVIDER` values are treated as
  unset and fall through to auto-resolution.

`instrumentation.ts` uses the resolved id to alias-bind
`CmsAdapter -> CmsAdapter:<id>` at bootstrap; `getCmsService()` re-establishes
that alias on the render-graph container when needed (see above). Both delegate
the actual bind decision to the shared server-only helper
`bindActiveCmsAdapter(container, env)`, so the alias-vs-composite choice (next
section) is identical on both module graphs.

## Default-content fallback (composite adapter)

A fresh clone whose primary CMS space is still empty would render a blank
shell. The opt-in **composite fallback** wraps the active provider so that a
`{ notfound: true }` from the primary falls back to a default-content source —
the version-controlled showcase tree under `data/cms/_default_`, served by the
local-JSON adapter.

- Enabled by `NEXT_CMS_FALLBACK_PROVIDER`. Values: `mock` (alias for
  `local`) | `local` | empty. `resolveCmsFallbackProvider(env)` resolves it to a
  source provider id or `null`. Empty / whitespace / unknown values, and any
  value equal to the active primary (self-wrap guard), resolve to `null`.
- When `null`, the composite layer is **transparently absent**: the primary
  binds directly, behaviour is identical to having no fallback.
- When a source is resolved and its `CmsAdapter:<id>` target is bound,
  `bindActiveCmsAdapter` binds `CmsAdapter` to a `FallbackCmsAdapter` instance
  (`new`-ed and bound via `toConstantValue`, not `@injectable` — see ADR 0001).
- `FallbackCmsAdapter` queries the fallback source against the fixed
  `_default_` site (from `getCmsLocalDefaultSite()`), regardless of the
  caller's `site` hint. Its optional surface (`getEditableProps` /
  `BridgeScript` / webhook primitives) mirrors the **primary only** — the
  fallback's optional surface is never invoked, so webhook events never
  double-fire.

`.env.template` ships `NEXT_CMS_FALLBACK_PROVIDER=mock` so a fresh clone
sees the showcase out of the box; production deployments can clear it.

## How to add a new CMS provider

Adding a provider means **writing only a new adapter**. The application core —
the central renderer, the component map, the `CMSService` facade, and the UI
layer — stays unchanged (ADR 0001).

1. **Create the adapter folder** under
   `src/platform/integrations/<name>/cms/impl/`:
   - The adapter class, implementing the `CmsAdapter` SPI and decorated with
     `@injectable('CmsAdapter:<name>', 'Singleton')`.
   - A dedicated **mapper** that translates the provider's wire format into the
     agnostic `CMSPage` (component `type` discriminators + `id`, plus any
     rich-text fields lifted into the agnostic AST). Where the provider carries
     a construct the domain model does not express, drop or approximate it at
     this boundary — the application never sees provider-shaped data.
2. **Register the provider id**: append `<name>` to `CMS_PROVIDER_IDS` in
   `src/platform/services/cms/CmsProviderResolver.ts`. The `CmsProviderId`
   union and the runtime guard pick it up automatically.
3. **Satisfy the contract**: add a thin `<Adapter>.contract.test.ts` that calls
   `runCmsAdapterContract({ name, expectedId, build })`
   (`src/platform/services/cms/__tests__/CmsAdapter.contract.ts`). The suite
   asserts the cross-adapter invariants: a non-empty `id` matching the declared
   identifier, `hasContent()` returns a boolean and never throws, `getPage` /
   `getNavigation` always resolve (surfacing missing content as
   `{ notfound: true }` rather than rejecting), and that the optional surface —
   when present — has the right type.
4. **Do not touch the renderer or the application core.** No new render code, no
   provider SDK in the page shell, no edits to `cms-renderer.tsx` /
   `cms-page.tsx`. The drift-guard test enforces this.

The optional editing surface (`getEditableProps`, `BridgeScript`) is added only
if the provider needs it; omit it otherwise.

## Component pattern

CMS render components live under `src/components/cms/<name>/` and follow a fixed
co-located, schema-first structure (`schema.ts` + `<name>.tsx` +
`<name>.test.tsx` + `index.ts`), are registered in `component-map.ts` and
`component-schema.ts`, and are kept in lock-step by a drift-guard test. A
component is a Server Component by default; browser-only logic is extracted into
a `'use client'` island. See [ADR 0002](./adr/0002-cms-component-co-location-and-schema-first.md)
for the full pattern and rationale.

## Rich-text AST scope

Rich text is represented by an agnostic AST defined in
`src/components/cms/richtext/schema.ts` and rendered by the shared `<Richtext>`
component, so a Storyblok-sourced body and a local-JSON one render through the
same path.

The agnostic schema supports:

- **Blocks**: `heading` (levels 1–6), `paragraph`, `list` (ordered / unordered),
  `hr`, `image`, `quote`, `code`.
- **Inlines**: `text`, `br`, `link`.
- **Marks** (on text inlines): `bold`, `italic`, `code`, `underline`, `strike`.

The Storyblok mapper boundary is narrower than the schema, because it lifts a
TipTap document and not every TipTap construct maps cleanly. `StoryblokCmsMapper`
(`src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts`) **drops
rather than fakes** the TipTap nodes `blockquote`, `image`, and `code_block`, and
the marks `highlight`, `superscript`, and `subscript`. Those `quote` / `image` /
`code` blocks are still expressible in the agnostic schema and therefore usable
through the `local` provider's JSON fixtures — they are simply not produced by
the Storyblok path.
