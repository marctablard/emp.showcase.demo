# Emporix CMS Plugin — Installation & Setup Guide

Complete guide for installing and configuring the Emporix CMS extension
(folder name: `medienwerft-cms-plugin`) in your Next.js storefront.

> This document is the **CMS-specific** companion to the generic
> extension guide in [`README.md`](./README.md). Read that first if you
> have never worked with a Storefront extension before.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
   - [1. Add the Extension](#1-add-the-extension)
   - [2. Configure Tailwind CSS](#2-configure-tailwind-css)
   - [3. Install Dependencies](#3-install-dependencies)
   - [4. Generate DI Container](#4-generate-di-container)
   - [5. Mount the Theme Stylesheet Route](#5-mount-the-theme-stylesheet-route)
   - [6. Configure Environment Variables](#6-configure-environment-variables)
   - [7. Mount the Category Tree Route](#7-mount-the-category-tree-route)
   - [8. Mount the Component Registry Route](#8-mount-the-component-registry-route)
3. [Configuration](#configuration)
4. [Component Setup](#component-setup)
5. [Page Integration](#page-integration)
6. [Slot-Based Architecture](#slot-based-architecture)
7. [Editor Integration](#editor-integration)
8. [Per-Site Fallbacks](#per-site-fallbacks)
9. [Dynamic Themes](#dynamic-themes)
10. [API Key Authentication](#api-key-authentication)
11. [Cross-Origin Configuration](#cross-origin-configuration)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Next.js 14+ with App Router
- TypeScript 5+
- Dependency Injection system configured
- Emporix Custom Entities API access

## Installation

### 1. Add the Extension

The extension is located in `extensions/medienwerft-cms-plugin/`. It should already be present in your workspace.

### 2. Configure Tailwind CSS

The extension contains components with Tailwind classes. Since the `extensions/` directory is outside `src/`, Tailwind won't scan it by default. Add a `@source` directive to your global CSS file:

**Edit:** `src/app/globals.css`

```css
@import 'tailwindcss';

@source "../../extensions";
```

This tells Tailwind v4 to include all files under `extensions/` when scanning for utility classes during the build.

### 3. Install Dependencies

No additional npm packages are required. The extension uses the storefront's existing dependencies.

### 4. Generate DI Container

Before running the generator, set
`NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true` in your env (see
[§6](#6-configure-environment-variables)) — otherwise the client-side
DI bundle the live editor needs won't be emitted. Re-run
`generate` whenever this value changes.

Then run the DI generator to register the extension's services:

```bash
npm run generate
```

This will automatically discover and register the injectables shipped
with this extension (among others):

- `EmporixCMSService` — CMS page/layout fetching (backed by
  Emporix Custom Entities via `EmporixCmsApi`).
- `EmporixCmsApi` — thin API integration talking to the shared
  `EmporixSchemaApi`.
- `EmporixCMSSettingsService` — per-site fallbacks (see
  [Per-Site Fallbacks](#per-site-fallbacks)).
- `EmporixCMSThemeService` — dynamic CSS-variable overrides per site
  (see [Dynamic Themes](#dynamic-themes)).
- `TailwindCMSThemeTokenManifestService` — resolves the manifest of
  overridable theme tokens advertised to the editor.
- `AbstractCMSComponentService` / `AbstractCMSComponentDecoratorService`
  — abstract bases the storefront extends to provide its component
  registry and per-type server-side enrichers (see
  [Component Setup](#component-setup)). The concrete subclasses live
  in the host (`src/platform/services/cms/impl/`) so each storefront
  controls its own component catalogue and decorators.

Aliases declared in [`plugin.json`](./plugin.json) are applied
automatically:

| Alias                          | Concrete binding                       |
|--------------------------------|----------------------------------------|
| `CMSService`                   | `EmporixCMSService`                    |
| `CMSSettingsService`           | `EmporixCMSSettingsService`            |
| `CMSThemeService`              | `EmporixCMSThemeService`               |
| `CMSThemeTokenManifestService` | `TailwindCMSThemeTokenManifestService` |

### 5. Mount the Theme Stylesheet Route

The dynamic theme is served as a real CSS resource (see
[Dynamic Themes](#dynamic-themes)). Add a one-line route handler that
re-exports the implementation from the extension:

**Create:** `src/app/[site]/cms-theme.css/route.ts`

```ts
export { cmsThemeCssGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
```

The handler responds at `/<site>/cms-theme.css?v=<version>`. Without
this file the `<link>` emitted by `EmporixCmsThemeStyle` 404s.

### 6. Configure Environment Variables

Add the following to `.env` (or your environment-specific env files).
Substitute the placeholders with values from your Emporix tenant and
CMS editor deployment:

```env
# Emporix API credentials (required)
EMPORIX_TENANT=your-tenant
EMPORIX_CLIENT_ID=your-client-id
EMPORIX_CLIENT_SECRET=your-client-secret
EMPORIX_API_URL=https://api.emporix.io

# Editor origins allowed to embed the storefront iframe.
# Comma-separated; consumed by next.config.ts (see Cross-Origin Configuration).
CMS_EDITOR_ORIGINS=https://app.emporix.io

# Generate client-side DI containers. Required for live-editing — the
# editor iframe instantiates CMS services in the browser, so the DI
# generator must emit a client bundle alongside the server one.
# If you change this value, re-run `npm run generate`.
NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true

# Optional shared key for the iframe ↔ editor handshake.
# Omit in development; set in staging/production (see API Key Authentication).
NEXT_PUBLIC_CMS_EDITOR_API_KEY=your-secret-api-key
```

### 7. Mount the Category Tree Route

The CMS editor's category-picker UI asks the storefront for the site's
catalog tree (`REQUEST_CATEGORY_TREE` over postMessage). The bridge
answers by hitting a thin server route, so the Emporix call stays
server-side (no browser-origin scope or CORS friction). Add a one-line
route handler that re-exports the implementation from the extension:

**Create:** `src/app/api/cms/categories/tree/route.ts`

```ts
export { categoryTreeGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
```

The handler responds at:
- `GET /api/cms/categories/tree?site=<code>` — trees rooted at each
  catalog published to the site (used by the editor on category-picker
  open).
- `GET /api/cms/categories/tree?categoryId=<id>` — single tree rooted
  at the given id.

The `/api/cms/...` namespace is intentional: it keeps the plugin's
routes from colliding with any host-owned `/api/categories/*` surface
(shopper navigation, search facets, etc.) and signals at the URL level
that the response is editor-oriented. Without this file the editor's
category picker silently shows an empty list.

### 8. Mount the Component Registry Route

The Emporix CMS MCP server (`emporix-jas-cms-plugin/mcp-server`) needs a
JSON catalog of every component the storefront renders so AI agents can
author CMS content with valid types and prop shapes. Add a one-line
route handler that re-exports the implementation from the extension:

**Create:** `src/app/api/cms/component-registry/route.ts`

```ts
export { componentRegistryGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
```

The handler responds at:

- `GET /api/cms/component-registry` — full catalogue.
- `GET /api/cms/component-registry?theme=<name>` — filtered to the
  entries exposed under the given theme (theme-neutral entries are
  always included).

Wire format (validated server-side by the MCP plugin's zod schemas in
`mcp-server/src/tools/schemas.ts`):

```json
{
  "$schema": "https://emporix.io/cms/component-registry/v1",
  "components": {
    "<type>": {
      "type": "<type>",
      "label": "...",
      "description": "...",
      "props": { /* see PropDefinition */ },
      "defaultProps": { /* values used when the agent creates an instance */ },
      "allowedComponents": ["..."]
    }
  }
}
```

The handler reuses the same DI-bound `EmporixCMSComponentService` the
live editor consumes, so the schema the MCP serves to agents and the
schema the editor renders are guaranteed to agree without a parallel
source of truth. `$ref` references against `fieldDefinitions` are
expanded server-side, `allowedComponentTypes` collapses onto the wire
format's single `allowedTypes` key, and plugin-only fields (e.g.
`dynamicOptionsSource`) are stripped.

**Authentication.** When `NEXT_PUBLIC_CMS_EDITOR_API_KEY` is set, the
caller must send the same value as `X-Emporix-API-Key`; the comparison
runs in constant time. When the env var is unset (typical development)
the route accepts any caller — same posture as the live-editor iframe
handshake (see [API Key Authentication](#api-key-authentication)).

**Caching.** The response carries `Cache-Control: public, max-age=300`;
the MCP server additionally caches in-process for 5 minutes per
`(site, url)`, so editor-visible registry changes propagate to agents
within ~5 minutes without a deploy. To force a refresh, append a
cache-buster (e.g. `?v=2`) to the URL configured in CMS Settings.

**Configuring the URL in CMS.** After deploying, register the route in
the Emporix Admin under **Settings → Component Registries**: add a row
with **Site** = your site code and **URL** = the full URL of the
deployed route (e.g. `https://storefront.example.com/api/cms/component-registry`).
The MCP server reads this from `CMSSettings.componentRegistries` on the
next agent call.

**Quick test.** Hit the route directly to verify the shape passes the
MCP server's validation:

```bash
curl -i 'https://your-storefront.example/api/cms/component-registry' \
  -H 'X-Emporix-API-Key: <NEXT_PUBLIC_CMS_EDITOR_API_KEY>'
```

If the MCP server later returns `502` with a zod path
(`components.<Type>.props.<name>.type: Invalid enum value …`), that
prop's `type` is not in the supported set (see
[Field Types Reference](#3-field-types-reference)) — fix it in the
storefront's component service and re-run.

---

## Configuration

### 1. Service Interface Implementation

The extension defines the [`CMSComponentService`](./services/CMSComponentService.d.ts)
interface — the storefront's contract for advertising its CMS component
catalogue. The extension also ships an `AbstractCMSComponentService`
base class that handles theme filtering and the standard accessors;
the storefront's job is to extend it with a definition map.

The DI binding id is **`EmporixCMSComponentService`**.

**Create:** `src/platform/services/cms/impl/StorefrontCMSComponentService.ts`

```typescript
import dynamic from 'next/dynamic';
import { AbstractCMSComponentService } from '@extensions/medienwerft-cms-plugin/services/impl/AbstractCMSComponentService';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { injectable } from '@/platform/core/di/injectable';

const Hero = dynamic(() => import('@/components/cms/hero'));
// ...other dynamic imports

const definitionMap: Record<string, CMSComponentEntry> = {
  hero: {
    definition: { /* see Component Setup */ },
    mapProps: (cmsProps) => ({ /* ... */ }),
    component: Hero,
  },
  // ...other entries
};

@injectable('EmporixCMSComponentService', 'Singleton')
export class StorefrontCMSComponentService extends AbstractCMSComponentService {
  constructor() {
    super(definitionMap);
  }
}

export default StorefrontCMSComponentService;
```

The interface itself (in case you need a non-`Abstract` implementation):

```typescript
interface CMSComponentService {
  getDefinitions(theme?: string): CMSComponentEntry[];
  getDefinition(type: string, theme?: string): CMSComponentEntry | undefined;
  getComponentTypes(theme?: string): string[];
  getTheme?(): string | undefined;
}
```

Notes:

- `getDefinitions` returns an **array**, not a record.
- The optional `theme` argument lets the same registry expose a
  different subset of components per active theme — entries can opt
  into theme scoping by setting `themes: ['<theme-name>']` on the
  `CMSComponentEntry`. Theme-neutral entries (no `themes` field) are
  always returned.

#### Optional: Per-Type Server-Side Decorators

If a component needs server-fetched data (categories, navigation
trees, etc.) merged into its props before SSR, register a decorator
by extending `AbstractCMSComponentDecoratorService` and binding it as
`EmporixCMSComponentDecoratorService`. The extension's
`EmporixCMSService.getPage` invokes registered decorators inside the
request-scoped DI container so the result is fully SSR-compatible.

```typescript
// src/platform/services/cms/impl/CustomCMSComponentDecoratorService.ts
import { inject } from 'inversify';
import { AbstractCMSComponentDecoratorService } from '@extensions/medienwerft-cms-plugin/services/impl/AbstractCMSComponentDecoratorService';
import type {
  CMSComponentDecorator,
} from '@extensions/medienwerft-cms-plugin/services/CMSComponentDecoratorService';
import { injectable } from '@/platform/core/di/injectable';
import type { CategoryService } from '@/platform/services/category/CategoryService';

@injectable('EmporixCMSComponentDecoratorService', 'Singleton')
export class CustomCMSComponentDecoratorService extends AbstractCMSComponentDecoratorService {
  constructor(@inject('CategoryService') categoryService: CategoryService) {
    super({
      // Decorator key MUST match the component `type` id from your
      // `StorefrontCMSComponentService` registry.
      'custom-header': createCustomHeaderDecorator(categoryService),
    });
  }
}

function createCustomHeaderDecorator(categoryService: CategoryService): CMSComponentDecorator {
  return async (_component, { site }) => {
    if (!site) return { _category_tree: null };
    const trees = await categoryService.getCategoryTreesForSite(site);
    return { _category_tree: trees[0] ?? null };
  };
}
```

The decorator's return value is shallow-merged into the component's
props before `mapProps` runs, so prefix synthetic keys with `_` to
keep them out of the editor schema.

---

## Component Setup

### 1. Create Component Definitions

A `CMSComponentEntry` bundles three concerns:

- `definition` — the editor schema (`CMSComponentTypeDefinition`):
  type id, label, prop fields, default values.
- `mapProps` — a pure function translating raw CMS payload props into
  the React component's props.
- `component` — the React component itself (typically a
  `next/dynamic` import so the bundle stays lean).

**Example definition (`hero`):**

```typescript
import type { CMSComponentTypeDefinition } from '@extensions/medienwerft-cms-plugin/types';

const heroDefinition: CMSComponentTypeDefinition = {
  type: 'hero',
  label: 'Hero Section',
  description: 'Large banner with headline, text, and call-to-action',

  props: {
    headline:    { label: 'Headline',          type: 'text', required: true },
    subheadline: { label: 'Subheadline',       type: 'textarea' },
    image:       { label: 'Background Image',  type: 'media', allowedTypes: ['image/*'] },
    cta_text:    { label: 'CTA Button Text',   type: 'text' },
    cta_link:    { label: 'CTA Button Link',   type: 'url' },
  },

  defaultProps: {
    headline: 'Welcome',
    subheadline: '',
    image: { filename: '', alt: '' },
    cta_text: 'Learn More',
    cta_link: '',
  },
};

function mapHeroProps(cmsProps: Record<string, any>) {
  return {
    headline: cmsProps.headline ?? '',
    subheadline: cmsProps.subheadline ?? '',
    backgroundImage: cmsProps.image?.filename ?? '',
    imageAlt: cmsProps.image?.alt ?? '',
    ctaText: cmsProps.cta_text ?? '',
    ctaLink: cmsProps.cta_link ?? '',
  };
}
```

> Tip: shared field shapes (e.g. an `image` or `button` object) can
> be declared once on `CMSComponentTypeDefinition.fieldDefinitions`
> and referenced via `{ $ref: '<key>' }` from individual props:
>
> ```typescript
> const sharedFieldDefinitions = {
>   image: {
>     label: 'Image',
>     type: 'object' as const,
>     properties: {
>       filename: { label: 'Image URL', type: 'text' as const, required: true },
>       alt:      { label: 'Alt Text',  type: 'text' as const },
>     },
>   },
> };
>
> const myDefinition: CMSComponentTypeDefinition = {
>   type: 'my-component',
>   label: 'My Component',
>   fieldDefinitions: sharedFieldDefinitions,
>   props: {
>     image: { $ref: 'image', label: 'Background', type: 'media', required: true },
>   },
>   defaultProps: { image: { filename: '', alt: '' } },
> };
> ```

### 2. Register Components

Definitions are registered by populating the `definitionMap` consumed
by your `StorefrontCMSComponentService` ([§Configuration §1](#1-service-interface-implementation)).
Either inline the entries directly in the service file (as the bundled
storefront does) or extract them into a colocated module — the only
contract that matters is the shape passed to `super(definitionMap)`.

```typescript
// src/platform/services/cms/impl/StorefrontCMSComponentService.ts
const definitionMap: Record<string, CMSComponentEntry> = {
  [heroDefinition.type]: {
    definition: heroDefinition,
    mapProps: mapHeroProps,
    component: dynamic(() => import('@/components/cms/hero')),
  },
  // ...other entries
};
```

Theme-scoped entries opt in by setting `themes: ['<theme-name>']` on
the `CMSComponentEntry`; the abstract base filters them per request
based on the active theme (see [Dynamic Themes](#dynamic-themes)).

### 3. Field Types Reference

Available field types for component props:

- `text` - Single-line text input
- `textarea` - Multi-line text input
- `number` - Numeric input
- `boolean` - Checkbox
- `color` - Color picker
- `url` - URL input with validation
- `media` - File/image upload
- `select` - Dropdown with options
- `object` - Nested object structure
- `array` - List of items
- `component` - Nested component

---

## Page Integration

### Slot-Based Architecture

The plugin uses a slot-based architecture for flexible page layouts.
Two top-level wrappers are exported from `@extensions/medienwerft-cms-plugin/components`:

- `EmporixCmsPage` — renders a single CMS **page** (URL-addressable
  content). Used per route.
- `EmporixCmsLayout` — renders a CMS **layout** entity shared across
  multiple pages (chrome like global header / footer). Used inside a
  Next.js `layout.tsx` so its slots render around every child route.

Both expose named slots via `<EmporixContentSlot slot="..." />`.

There are two canonical patterns for wiring a Next.js route to
`EmporixCmsPage`. Pick the pattern based on whether the **route file**
owns one specific slug or every slug under a folder:

| Pattern                        | Use when                                                            | File path                                                       |
|--------------------------------|---------------------------------------------------------------------|-----------------------------------------------------------------|
| 1. Predefined-slug pages       | One route file maps to one CMS page (`/`, `/about`, `/contact`)     | `src/app/[site]/[locale]/<group>/page.tsx`                      |
| 2. Catch-all dynamic routes    | CMS owns every URL under a route group (`/promo/*`, `/legal/*`, …)  | `src/app/[site]/[locale]/<group>/[...slug]/page.tsx`            |

Both patterns share the same essentials:

- **Always forward `searchParams`** to `EmporixCmsPage`. The live-editor
  handshake reads `?editMode=true` from there; without forwarding,
  postMessage updates silently no-op.
- **`setRequestSite` / `setRequestLocale` are host helpers**, not
  extension API. Include them only if the host's existing routing
  layer expects them. The CMS plugin itself doesn't require either.
- **The `theme` prop is optional.** Pass it only when your
  `StorefrontCMSComponentService` scopes definitions per theme (see
  [Dynamic Themes](#dynamic-themes)) — for example
  `theme={siteData?.theme}` when a per-site theme name is available.
  Adding it later is one prop.
- **Wire up `generateMetadata`** so the browser tab title and the
  `<meta name="description">` come from the CMS page entity. The CMS
  page model carries `title` and `description` fields editors fill in
  per page; without `generateMetadata` the page renders with whatever
  defaults the parent layout supplies, and SEO/social previews fall
  back to those defaults. See
  [Page Metadata](#page-metadata) below — both route patterns share
  the same approach.

### Page Metadata

Both route patterns drive Next.js' `generateMetadata` from the same
CMS payload `EmporixCmsPage` will fetch a moment later. Two things to
know:

- `fetchCMSPage` is re-exported from
  `@extensions/medienwerft-cms-plugin/components` for use inside
  `generateMetadata`. It returns either a `CMSPage` or
  `{ notfound: true }` — the same union the page wrapper consumes.
- The call is deduped per request via React's `cache()`, so wiring up
  `generateMetadata` adds zero extra round-trips: SSR fetches once and
  both the metadata and the body read the same payload.

The CMS `STOREFRONT_CMS_PAGE` entity exposes two editor-facing fields
intended for metadata:

| Field          | Maps to                              |
|----------------|--------------------------------------|
| `title`        | Next.js `metadata.title` (tab title) |
| `description`  | Next.js `metadata.description` (`<meta name="description">`) |

A 404 payload returns a fixed `'Page not found'` title so the browser
tab still reads sensibly when an editor unpublishes a slug while a
shopper is on the page. The exact rendering for each route pattern is
shown in the sections that follow.

### 1. Predefined-Slug Pages

Use this pattern when one route file maps to one CMS page with a known
slug — the home page, an `/about` page, anything where the slug is
hardcoded by the developer rather than derived from the URL.

**Create:** `src/app/[site]/[locale]/<route-group>/page.tsx`

```tsx
import { setRequestLocale } from 'next-intl/server';
import {
  EmporixCmsPage,
  EmporixContentSlot,
  fetchCMSPage,
} from '@extensions/medienwerft-cms-plugin/components';
import type { CMSPage } from '@extensions/medienwerft-cms-plugin/types';
import { setRequestSite } from '@/site/server';

interface HomePageParams {
  locale: string;
  site: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<HomePageParams>;
}) {
  const { locale, site } = await params;
  const data = await fetchCMSPage('home', locale, site);
  if ('notfound' in data) {
    return { title: 'Page not found' };
  }
  const page = data as CMSPage;
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<HomePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
}) {
  const { locale, site } = await params;
  const searchParamsData = await searchParams;

  setRequestSite(site);
  setRequestLocale(locale);

  return (
    <EmporixCmsPage
      slug="home"
      locale={locale}
      site={site}
      searchParams={searchParamsData}
    >
      <EmporixContentSlot slot="main" />
    </EmporixCmsPage>
  );
}
```

The slug passed to `fetchCMSPage` (`'home'` above) **must** match the
slug used in the `<EmporixCmsPage slug="…">` JSX below it. Pass the
same string in both places so metadata and content describe the same
CMS entity.

The hardcoded slug (`"home"` above) is the `slug` attribute on the
corresponding `STOREFRONT_CMS_PAGE` Custom Entity row — pick whatever
your editors use to identify the page. Multiple route files can each
hardcode their own slug:

```tsx
// src/app/[site]/[locale]/(default)/about/page.tsx
<EmporixCmsPage slug="about" locale={locale} site={site} searchParams={searchParamsData}>
  <EmporixContentSlot slot="main" />
</EmporixCmsPage>
```

### 2. Catch-All Dynamic Routes

Use this pattern when CMS pages drive arbitrary URL paths under a route
group — `/about`, `/promo/spring-sale`, `/legal/imprint`, etc. — and
you want a single route file to resolve all of them by slug.

The Next.js catch-all segment (`[...slug]`) captures the URL path as a
**string array**; join it back with `/` before handing it to the CMS.

**Create:** `src/app/[site]/[locale]/<route-group>/[...slug]/page.tsx`

```tsx
import { setRequestLocale } from 'next-intl/server';
import {
  EmporixCmsPage,
  EmporixContentSlot,
  fetchCMSPage,
} from '@extensions/medienwerft-cms-plugin/components';
import type { CMSPage } from '@extensions/medienwerft-cms-plugin/types';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<DynamicPageParams>;
}) {
  const { slug, locale, site } = await params;
  const data = await fetchCMSPage(slug.join('/'), locale, site);
  if ('notfound' in data) {
    return { title: 'Page not found' };
  }
  const page = data as CMSPage;
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<DynamicPageParams>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { slug, locale, site } = await params;
  const searchParamsData = await searchParams;

  setRequestSite(site);
  setRequestLocale(locale);

  return (
    <EmporixCmsPage
      slug={slug.join('/')}
      locale={locale}
      site={site}
      searchParams={searchParamsData}
    >
      <EmporixContentSlot slot="main" />
    </EmporixCmsPage>
  );
}
```

Notes:

- Use `[...slug]` (catch-all). `[slug]` (single segment) would only
  match one path component, so `/legal/imprint` would not resolve.
- `fetchCMSPage` runs both inside `generateMetadata` and again inside
  `EmporixCmsPage`. The calls are deduped per request via React's
  `cache()`, so the page payload is fetched once per request.
- `'notfound' in data` is the type discriminator: `fetchCMSPage`
  returns either a `CMSPage` or `{ notfound: true }`.
- Catch-all routes claim every URL in the route group. To serve a
  **different** page at the group root (`/<site>/<locale>/`), keep a
  predefined-slug `page.tsx` next to the `[...slug]/` folder — Next.js
  resolves static routes before catch-alls.
- Catch-all and a sibling single-segment dynamic (`[id]/page.tsx`)
  conflict — pick one per route group.

### 3. Custom Layouts

You have full control over page structure:

```tsx
<EmporixCmsPage slug="product-page" locale={locale} site={site}>
  {/* Full-width header */}
  <EmporixContentSlot slot="header" className="w-full" />
  
  {/* Two-column layout */}
  <div className="grid grid-cols-12 gap-6">
    <aside className="col-span-3">
      <EmporixContentSlot slot="sidebar" />
    </aside>
    
    <main className="col-span-9">
      <EmporixContentSlot slot="content" />
    </main>
  </div>
  
  {/* Full-width footer */}
  <EmporixContentSlot slot="footer" className="w-full bg-gray-100" />
</EmporixCmsPage>
```

### 4. Shared Chrome via `EmporixCmsLayout`

Use `EmporixCmsLayout` inside a Next.js segment `layout.tsx` so a
single CMS layout entity (`layoutId`) drives the chrome across every
child route. The example below mirrors the pattern used by the
bundled `(default)`, `(reduced)`, and `(no-margin)` route groups in
this storefront:

```tsx
// src/app/[site]/[locale]/(default)/layout.tsx
import { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsLayout, EmporixContentSlot } from '@extensions/medienwerft-cms-plugin/components';
import { setRequestSite } from '@/site/server';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; site: string }>;
}) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);

  return (
    <EmporixCmsLayout layoutId="default" locale={locale} site={site}>
      <header>
        <EmporixContentSlot slot="top" />
      </header>
      <main className="flex-grow">{children}</main>
      <footer>
        <EmporixContentSlot slot="bottom" />
      </footer>
    </EmporixCmsLayout>
  );
}
```

The `layoutId` is the `id` of a `CMSLayout` custom-entity row
(`default`, `reduced`, etc.) — pick whichever your editors use to
distinguish chrome variants.

---

## Slot-Based Architecture

Slots are named containers for CMS components. They give the host full
control over page layout and give the editor consistent anchors for
drag-and-drop.

- **Layout slots** live on a `CMSLayout` entity, render across multiple
  pages (e.g. `header`, `footer`). In editor mode they are outlined in
  purple.
- **Page slots** live on a `CMSPage` entity, render per page (e.g.
  `main`, `hero`). In editor mode they are outlined in green.
- **Empty states** render a placeholder in editor mode with the slot
  name so editors can find their drop target.
- **Highlighted component** — when a component is selected in the
  editor, the preview wraps it in a blue ring.

Example — a typical product page:

```tsx
<EmporixCmsPage slug="product" locale={locale} site={site}>
  <header>
    <EmporixContentSlot slot="header" className="bg-white shadow" />
  </header>

  <div className="container mx-auto grid grid-cols-4 gap-6">
    <aside className="col-span-1">
      <EmporixContentSlot slot="filters" />
    </aside>
    <main className="col-span-3">
      <EmporixContentSlot slot="hero" className="mb-8" />
      <EmporixContentSlot slot="products" />
    </main>
  </div>

  <footer>
    <EmporixContentSlot slot="footer" className="bg-gray-900 text-white" />
  </footer>
</EmporixCmsPage>
```

A deeper write-up is in [`docs/slot-based-architecture.md`](./docs/slot-based-architecture.md).

---

## Editor Integration

The editor talks to the storefront iframe via `window.postMessage`. The
extension ships one hook per concern so the message surface stays
small:

- `useCMSLiveEditor` — component + slot updates, metadata, highlights,
  category tree requests.
- `useCMSThemeLiveEditor` — live theme-variable preview (see
  [Dynamic Themes](#dynamic-themes)).

Supported messages (all typed in [`types.d.ts`](./types.d.ts)):

| Message                   | Direction              | Purpose                                      |
|---------------------------|------------------------|----------------------------------------------|
| `IFRAME_READY`            | Storefront → Editor    | Signal ready state (optional API key).       |
| `REQUEST_COMPONENT_TYPES` | Editor → Storefront    | Request available component types.           |
| `COMPONENT_TYPES`         | Storefront → Editor    | Send component definitions.                  |
| `UPDATE_SLOT`             | Editor → Storefront    | Add/update/delete/reorder components.        |
| `UPDATE_LAYOUT`           | Editor → Storefront    | Change slot configuration.                   |
| `UPDATE_METADATA`         | Editor → Storefront    | Update page title/description/slug.          |
| `HIGHLIGHT_COMPONENT`     | Editor → Storefront    | Highlight a selected component.              |
| `HIGHLIGHT_SLOT`          | Editor → Storefront    | Highlight a selected slot.                   |
| `REQUEST_CATEGORY_TREE`   | Editor → Storefront    | Request the site's category tree.            |
| `CATEGORY_TREE_RESPONSE`  | Storefront → Editor    | Reply to `REQUEST_CATEGORY_TREE`.            |
| `NAVIGATION_INTERCEPTED`  | Storefront → Editor    | Internal link click caught in preview.       |
| `NAVIGATION_RESPONSE`     | Editor → Storefront    | Allow the previously intercepted navigation. |
| `REQUEST_THEME`           | Editor → Storefront    | Request the currently applied theme.         |
| `THEME_RESPONSE`          | Storefront → Editor    | Reply with applied theme variables.          |
| `UPDATE_THEME_VARIABLES`  | Editor → Storefront    | Live-preview theme CSS variables.            |
| `RESET_THEME_VARIABLES`   | Editor → Storefront    | Restore the server-rendered theme.           |
| `REQUEST_THEME_TOKENS`    | Editor → Storefront    | Request the manifest of overridable tokens.  |
| `THEME_TOKENS_RESPONSE`   | Storefront → Editor    | Reply with the resolved token manifest.      |

---

## Per-Site Fallbacks

Pages and layouts can fall back to another site/locale when the
requested row does not exist — e.g. `us-branch` falls back to `main`,
any-locale falls back to `en`. The extension reads the fallback map
from the `STOREFRONT_CMS_SETTINGS` custom entity via its
`CMSSettingsService` (extension-owned, bound by DI).

**Settings attribute shape:**

```json
{
  "site_fallbacks": [
    { "site": "us-branch", "fallback_site": "main", "fallback_locale": "en" },
    { "site": "main" }
  ]
}
```

**UI rules:**

- `site` — the primary site code this entry applies to.
- `fallback_site` — another site code or empty.
- `fallback_locale` — a locale or empty.

Missing entries → no fallback (page/layout is `notfound`).

The Emporix Custom Entity read in `EmporixCmsSettingsApi` runs with
`next: { revalidate: 300 }`, so a saved `site_fallbacks` payload
propagates to every shopper within ~5 minutes. There is no editor-
side cache invalidation hook — the TTL is the contract.

---

## Dynamic Themes

Base themes live in `src/app/styles/themes/*.css` and are scoped by
body class (`theme-<name>`). The extension adds a **runtime override
layer** per site so editors can tweak CSS custom properties without a
code change.

### How it works

1. A `STOREFRONT_CMS_THEME` custom entity is stored per site (one
   live row, optional draft row, archived timestamped rows). The
   schema, id convention, and validation rules are documented in
   [`docs/editor-schema.md`](./docs/editor-schema.md).
2. `EmporixCMSThemeService` (DI-bound, extension-owned) reads the
   entity, sanitizes keys/values, and returns `{ baseTheme, variables,
   version }`.
3. The `EmporixCmsThemeStyle` server component emits a
   `<link rel="stylesheet" href="/<site>/cms-theme.css?v=<version>"
   precedence="...">`. React 19 hoists this into `<head>` and dedupes
   it across renders. The CSS body itself is served by the
   `app/[site]/cms-theme.css` route handler ([§Installation §5](#5-mount-the-theme-stylesheet-route)),
   which calls the same `fetchCMSTheme(site)` helper SSR uses — so the
   linked resource and the page that requests it always agree on
   selector + variables. Versioned URLs are returned with
   `Cache-Control: public, max-age=31536000, immutable`, so a publish
   bump invalidates downstream caches by URL change alone.
4. The selector inside the served CSS is either `.theme-<baseTheme>`
   (when a base theme is configured) or `body[data-cms-site="<site>"]`
   (the attribute-only fallback — this is why
   [`src/app/[site]/[locale]/layout.tsx`](../../src/app/%5Bsite%5D/%5Blocale%5D/layout.tsx)
   stamps `data-cms-site={siteCode}` on `<body>`).
5. In editor mode, `EmporixCmsThemeLiveBridge` (a thin client
   companion mounted by `EmporixCmsThemeStyle`) listens for
   `UPDATE_THEME_VARIABLES` messages and appends an in-memory
   `<style>` block **after** the persisted `<link>` for
   sub-frame-latency preview. The `<link>` is never mutated — drafts
   live entirely in the bridge's own style node.

### Storefront integration

Add **one import and one JSX line** to
`src/app/[site]/[locale]/layout.tsx`, plus a `data-cms-site` attribute
on the body element so the fallback selector can target the active
site:

```tsx
import { EmporixCmsThemeStyle } from '@extensions/medienwerft-cms-plugin/components';

// ...on the <body> element:
<body data-cms-site={siteCode} className={`... ${themeClass}`.trim()}>
  <EmporixCmsThemeStyle site={siteCode} themeClass={themeClass || undefined} />
  {/* ...rest of the layout */}
</body>
```

Editor-mode detection is handled client-side by
`EmporixCmsThemeLiveBridge` (Next.js layouts don't receive
`searchParams`) — the bridge only activates when the page is running
inside the CMS editor iframe (`window.parent !== window` +
`?editMode=true`).

That's the entire footprint — all theme logic lives in the extension.

### Validation rules (mirrored server-side)

- **Keys:** must match `^--[a-zA-Z0-9_-]+$`.
- **Values:** must match `^[\w\d\s#,.()%/\-]*$`; no `;`, `{`, `}`, `<`,
  `>`. Invalid entries are dropped (and logged) before render.
- **Payload:** `variables` is a JSON **object**, not array —
  `{ "--brand-primary": "#ff5500", "--brand-foreground": "#111111" }`.

### Editor integration notes (for the CMS editor team)

- Open the preview with `?editMode=true&cmsThemeVersion=draft`.
- On each value change, post `UPDATE_THEME_VARIABLES` with
  `mode: 'merge'` for instant preview (< 16 ms).
- Use `REQUEST_THEME_TOKENS` to discover which CSS variables the
  storefront advertises as overridable — the live bridge replies
  with `THEME_TOKENS_RESPONSE` from a manifest the storefront
  resolved during SSR (no HTTP call).
- Debounce network saves to the draft row (~1 s trailing).
- On Publish, move the draft into `cms-theme-<site>` (live). Shoppers
  see the change within ~5 minutes (`next: { revalidate: 300 }` on
  the live theme fetch); no cache-invalidation API is involved.
- On Discard, post `RESET_THEME_VARIABLES` and delete the draft row.
- The existing `IFRAME_READY` handshake is reused — no new signal.

---

## API Key Authentication

The CMS editor optionally validates a shared key sent in the
`IFRAME_READY` handshake. The plugin reads
`NEXT_PUBLIC_CMS_EDITOR_API_KEY` (set in [§Installation §6](#6-configure-environment-variables))
and includes it automatically:

```json
{ "type": "IFRAME_READY", "apiKey": "your-secret-api-key" }
```

If the key doesn't match the editor's expected value, the editor
blocks editing.

- **Optional in development.** Leave the var unset and the handshake
  omits the key — editing still works.
- **Required in production.** Use a different value per environment
  and rotate it regularly. The key only gates editing; it is not a
  data secret, but treat it like one (don't commit, don't share).

---

## Cross-Origin Configuration

The CMS editor embeds your storefront in an iframe for live preview,
so the storefront must opt the editor's origin in to three policies:

- **CSP `frame-ancestors`** — allows the editor to embed the page.
- **`X-Frame-Options`** — legacy fallback for older browsers; aligned
  with the CSP allow-list.
- **CORS** on `/api/*` — only required if iframe-side code makes
  same-origin-restricted API calls (most don't need this).

All of it lives in one `headers()` callback in `next.config.js` /
`next.config.ts`. Drop this in (or merge into your existing
`headers()` if you already have one):

```ts
// next.config.ts
import type { NextConfig } from 'next';

// Comma-separated list of editor origins, e.g.
//   CMS_EDITOR_ORIGINS=https://app.emporix.io,https://staging-app.emporix.io
const editorOrigins = (process.env.CMS_EDITOR_ORIGINS ?? 'https://app.emporix.io')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV === 'development';
const frameAncestors = ["'self'", ...editorOrigins, ...(isDev ? ['http://localhost:*'] : [])].join(' ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Iframe-embedding policy — applies to every storefront route.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`,
          },
          // X-Frame-Options can only name a single origin; pick the
          // primary one. Modern browsers prefer the CSP above.
          {
            key: 'X-Frame-Options',
            value: `ALLOW-FROM ${editorOrigins[0]}`,
          },
        ],
      },
      {
        // CORS for API routes — only needed if the iframe makes
        // cross-origin fetches against your storefront's API.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: editorOrigins[0] },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Verification

1. Open the CMS editor and load a page in preview mode.
2. Check the browser console for CSP / CORS errors. Common ones:
   - `Refused to display in a frame because it set 'X-Frame-Options' to 'deny'`
   - `Refused to frame because an ancestor violates the following Content Security Policy`
3. Confirm the iframe renders.

### Security notes

- Whitelist specific origins — don't use `*` in production.
- Always use HTTPS for editor and storefront.
- Validate `event.origin` in any custom `postMessage` handlers on top
  of what the extension's hooks already do.
- Monitor server logs for CSP violation reports if you've configured a
  reporting endpoint.

---

## Troubleshooting

### Components Not Rendering

**Check console logs:**
```
[useCMSLiveEditor] Initializing with contentSlots: {...}
[EmporixContentSlot] Rendering slot "main": {...}
```

**Common issues:**
1. **Empty contentSlots** - Check if `EmporixCmsApi` is populating the `contentSlots` object
2. **Slot name mismatch** - Ensure slot names in JSX match data (e.g., 'main' vs 'content')
3. **Missing components** - Verify components are registered in your `StorefrontCMSComponentService` definition map

### Service Not Found Error

```
Error: Service 'EmporixCMSComponentService' not found
```

(In dev mode the storefront also renders a full-page banner from
[`cms-setup-missing-banner.tsx`](./components/cms-setup-missing-banner.tsx)
when this binding is missing.)

**Solution:**
1. Verify your `StorefrontCMSComponentService` implementation exists
   under `src/platform/services/cms/impl/`
2. Check the `@injectable('EmporixCMSComponentService', 'Singleton')`
   decorator is present
3. Run `npm run generate`
4. Restart dev server

### Theme Stylesheet 404

If the browser console shows a 404 for `/<site>/cms-theme.css`, the
route handler from [§Installation §5](#5-mount-the-theme-stylesheet-route)
is missing or mis-pathed. Recreate
`src/app/[site]/cms-theme.css/route.ts` exactly as shown there — the
folder name **must** be the literal `cms-theme.css` segment.

### Type Errors

```
Property 'contentSlots' does not exist on type 'CMSPage'
```

**Solution:**
The extension extends the base `CMSPage` type. Ensure you're importing from the extension:

```typescript
import type { CMSPage } from '@extensions/medienwerft-cms-plugin/types';
```

### Stale Component Definitions

**Solution:**
1. Clear Next.js cache: `rm -rf .next`
2. Restart dev server: `npm run dev`
3. Hard refresh browser: `Ctrl+Shift+R` / `Cmd+Shift+R`

### Editor Not Connecting

**Check:**
1. Editor URL includes `?editMode=true` parameter
2. Browser console for postMessage errors
3. CORS settings allow iframe embedding
4. `IFRAME_READY` message is sent

---

## Architecture Overview

### Dependency Inversion Principle

The plugin follows the **Dependency Inversion Principle**:

- **Extension defines interfaces** - What it needs
- **Storefront implements interfaces** - How to provide it
- **DI container connects them** - Runtime wiring

```
┌─────────────────────────────────────┐
│   CMS Extension (High-Level)        │
│   - Defines CMSComponentDefinition  │
│     Service interface               │
│   - Uses service via DI             │
└──────────────┬──────────────────────┘
               │ DI Container
┌──────────────▼──────────────────────┐
│   Storefront (Low-Level)            │
│   - Implements interface            │
│   - Provides component definitions  │
└─────────────────────────────────────┘

---

## Next Steps

1. **Create Component Definitions** - Define your CMS components
2. **Implement Service** - Provide component definitions to extension
3. **Build Pages** - Use slot-based architecture for layouts
4. **Test Editor Integration** - Verify live editing works
5. **Deploy** - Build and deploy your CMS-powered storefront

## Additional Resources

- [Component Definitions Guide](./docs/component-definitions.md)
- [Architecture Documentation](./docs/architecture.md)
- [Slot-Based Architecture](./docs/slot-based-architecture.md)
- [Component Definition Service](./docs/component-definition-service.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the detailed documentation in `/docs`
3. Check browser console for error messages
4. Verify DI container is properly generated
