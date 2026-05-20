# CMS Plugin — Install Protocol

Generated after the agent install of `extensions/medienwerft-cms-plugin`
into `mr-showcase` (branch: `feature/mf-cms-extension`).

This document has two sections — first what the agent did, second
what you still need to do by hand. Read both end-to-end before
restarting the dev server.

---

## 1. What was done

### 1.1 Extension wiring

- Appended `@source "../../extensions"` (line 2) to
  [src/app/globals.css](src/app/globals.css) so Tailwind v4 scans the
  extension's components. Added three new CSS variables in `:root` so
  the CMS theme editor can override CMS-component overlays:
  `--cms-overlay-light`, `--cms-overlay-dark`, `--cms-banner-radius`.
- Created [src/app/[site]/cms-theme.css/route.ts](src/app/%5Bsite%5D/cms-theme.css/route.ts)
  re-exporting `cmsThemeCssGET as GET` from the extension. The folder
  name contains the literal dot per the extension's contract.
- Created [src/app/api/cms/categories/tree/route.ts](src/app/api/cms/categories/tree/route.ts)
  re-exporting `categoryTreeGET as GET`. Backs the editor's category
  picker — without it the picker silently shows an empty tree.
- Created [src/app/api/cms/component-registry/route.ts](src/app/api/cms/component-registry/route.ts)
  re-exporting `componentRegistryGET as GET`. Serves the storefront's
  CMS component catalogue to the Emporix CMS MCP server so AI agents
  can discover what's available — without it the agent gets an empty
  list.
- Merged CMS editor headers into [next.config.ts](next.config.ts)'s
  existing `headers()` callback: `Content-Security-Policy: frame-ancestors`
  and `X-Frame-Options: ALLOW-FROM` driven by `CMS_EDITOR_ORIGINS`,
  with a dev-mode `http://localhost:*` exception. Existing security
  headers were preserved.
- Updated the root layout
  [src/app/[site]/[locale]/layout.tsx](src/app/%5Bsite%5D/%5Blocale%5D/layout.tsx):
  added `data-cms-site={siteCode}` on `<body>` and rendered
  `<EmporixCmsThemeStyle site={siteCode} />` as the first child of
  `<body>`. All existing providers, fonts, and class names preserved.

### 1.2 Environment variables

- [.env](.env) — appended:
  - `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true` (required so
    `npm run generate` emits `src/platform/client.ts` for live editing).
- [.env.template](.env.template) — appended a CMS section documenting:
  - `CMS_EDITOR_ORIGINS` (required, comma-separated editor origins)
  - `NEXT_PUBLIC_CMS_EDITOR_API_KEY` (optional, dev unset)
  - `CMS_LIVE_PAGE_CACHE_SECONDS` (optional, default 60)
  - `CMS_LIVE_LAYOUT_CACHE_SECONDS` (optional, default 60)
- [.env.local](.env.local) — created with `CMS_EDITOR_ORIGINS=https://admin.emporix.io`.
  Note: `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` lives in `.env` because
  the host's `scripts/di-generator.ts` only loads `.env`, not `.env.local`.

### 1.3 DI services (`src/platform/services/cms/impl/`)

- Created [StorefrontCMSComponentService.ts](src/platform/services/cms/impl/StorefrontCMSComponentService.ts) —
  `@injectable('EmporixCMSComponentService', 'Singleton')`,
  registers all 19 catalogue components in `definitionMap`.
- Created [StorefrontCMSComponentDecoratorService.ts](src/platform/services/cms/impl/StorefrontCMSComponentDecoratorService.ts) —
  `@injectable('EmporixCMSComponentDecoratorService', 'Singleton')`,
  decorator for `cms-category-tile-row` only. Pre-fetches localized
  category metadata via `CategoryService.getCategoryById` so the tile
  row renders names/slugs/images server-side.
- Ran `npm run generate` — DI container regenerated; both new
  services bound; `src/platform/{server,ssr,client}.ts` re-emitted
  with the extension's 8 injectables plus the storefront's two new
  ones.

### 1.4 Component catalogue (`src/components/cms-custom/`)

19 components, all theme-driven via host CSS tokens (`--color-*`,
`--spacing-*`, `--border-radius-*`). Layout/function via props.

| Component                  | File                                                                                                |
|----------------------------|-----------------------------------------------------------------------------------------------------|
| `cms-header`               | [header.tsx](src/components/cms-custom/header.tsx)                                                   |
| `cms-footer`               | [footer.tsx](src/components/cms-custom/footer.tsx)                                                   |
| `cms-hero-banner`          | [hero-banner.tsx](src/components/cms-custom/hero-banner.tsx)                                         |
| `cms-section`              | [section.tsx](src/components/cms-custom/section.tsx)                                                 |
| `cms-spacer`               | [spacer.tsx](src/components/cms-custom/spacer.tsx)                                                   |
| `cms-rich-text`            | [rich-text.tsx](src/components/cms-custom/rich-text.tsx)                                             |
| `cms-heading`              | [heading.tsx](src/components/cms-custom/heading.tsx)                                                 |
| `cms-image`                | [image.tsx](src/components/cms-custom/image.tsx)                                                     |
| `cms-image-text`           | [image-text.tsx](src/components/cms-custom/image-text.tsx)                                           |
| `cms-video`                | [video.tsx](src/components/cms-custom/video.tsx)                                                     |
| `cms-gallery`              | [gallery.tsx](src/components/cms-custom/gallery.tsx) + [gallery-client.tsx](src/components/cms-custom/gallery-client.tsx) |
| `cms-quote`                | [quote.tsx](src/components/cms-custom/quote.tsx)                                                     |
| `cms-cta-button`           | [cta-button.tsx](src/components/cms-custom/cta-button.tsx)                                           |
| `cms-cta-banner`           | [cta-banner.tsx](src/components/cms-custom/cta-banner.tsx)                                           |
| `cms-newsletter-signup`    | [newsletter-signup.tsx](src/components/cms-custom/newsletter-signup.tsx) + [newsletter-signup-client.tsx](src/components/cms-custom/newsletter-signup-client.tsx) |
| `cms-feature-list`         | [feature-list.tsx](src/components/cms-custom/feature-list.tsx)                                       |
| `cms-product-grid`         | [product-grid.tsx](src/components/cms-custom/product-grid.tsx)                                       |
| `cms-category-tile-row`    | [category-tile-row.tsx](src/components/cms-custom/category-tile-row.tsx)                             |
| `cms-promo-card`           | [promo-card.tsx](src/components/cms-custom/promo-card.tsx)                                           |

Shared helpers under [_shared/](src/components/cms-custom/_shared/):

- [field-definitions.ts](src/components/cms-custom/_shared/field-definitions.ts):
  `sharedFieldDefinitions` (`image`/`link` `$ref` shapes), `SharedImage`,
  `SharedLink`, `resolveImageSrc(image)` (returns a usable
  `next/image` src or `undefined`), `normalizeMedia(value)` (handles
  whichever shape the editor returns from a `type: 'media'` field).
- [styles.ts](src/components/cms-custom/_shared/styles.ts):
  alignment / tone / density / radius / max-width helpers that map to
  existing host theme classes.

Two components are intentionally split into server/client pairs
because `'use client'` modules can't export `CMSComponentEntry`
constants without breaking the DI container. **Don't merge them
back.**

### 1.5 Route-group layouts (CMS-driven, no static chrome)

All three route groups under `src/app/[site]/[locale]/` were
wrapped with `EmporixCmsLayout` and the previous static
`<Header />` / `<Footer />` JSX was removed. The chrome is now owned
entirely by the CMS — editors must populate the layouts before the
storefront renders any header/footer.

- [(default)/layout.tsx](src/app/%5Bsite%5D/%5Blocale%5D/(default)/layout.tsx)
  → `<EmporixCmsLayout layoutId="default">` exposing slots
  `top` and `bottom` inside semantic `<header>` / `<footer>` HTML
  landmarks around `{children}`.
- [(reduced)/layout.tsx](src/app/%5Bsite%5D/%5Blocale%5D/(reduced)/layout.tsx)
  → `layoutId="reduced"`, same slot shape.
- [(no-margin)/layout.tsx](src/app/%5Bsite%5D/%5Blocale%5D/(no-margin)/layout.tsx)
  → `layoutId="no-margin"`, same slot shape.

### 1.6 Pages (`(no-margin)` only)

- [(no-margin)/page.tsx](src/app/%5Bsite%5D/%5Blocale%5D/(no-margin)/page.tsx)
  → `<EmporixCmsPage slug="home" ...>` with slot `main`. Forwards
  `searchParams` to the CMS page (required for the live-editor
  handshake). Includes `generateMetadata` against the same `home`
  slug for `<title>` / `<meta name="description">`.
- [(no-margin)/[...slug]/page.tsx](src/app/%5Bsite%5D/%5Blocale%5D/(no-margin)/%5B...slug%5D/page.tsx)
  → catch-all dynamic route. `generateMetadata` pre-fetches via
  `fetchCMSPage`, narrows with `'notfound' in data` (lowercase,
  matching the `CMSNoResult` type), returns `title`/`description`
  for found pages and `'Page not found'` otherwise. Forwards
  `searchParams`.

### 1.7 Live-read caching

- Updated [extensions/medienwerft-cms-plugin/integrations/impl/EmporixCmsApi.ts](extensions/medienwerft-cms-plugin/integrations/impl/EmporixCmsApi.ts):
  `getPage` and `getLayout` now pass a `cacheSeconds` arg to
  `getCustomEntity` when the requested version is `live` (or
  unspecified). Drafts and archived versions stay uncached.
- Defaults: 60 seconds, override per content type via
  `CMS_LIVE_PAGE_CACHE_SECONDS` / `CMS_LIVE_LAYOUT_CACHE_SECONDS`.
- Widened the host interface
  [src/platform/integrations/emporix/schema/EmporixSchemaApi.d.ts](src/platform/integrations/emporix/schema/EmporixSchemaApi.d.ts)
  to expose the optional `cacheSeconds` parameter the implementation
  already accepted.

### 1.8 Code fixes (extension + host)

- The `CMSNoResult` type stays lowercase `notfound?: boolean`
  (canonical per the updated AGENT_INSTALL.md). An earlier rename to
  `notFound` was reverted; all discriminator reads now use
  `'notfound' in data`.
- `EmporixCmsApi.mapEntityToPage` now returns `site` and `locale` on
  the `CMSPage` payload (sourced from the `CMS_PAGE_DATA` mixin).
  Cleared the pre-existing `error TS2739: Type … is missing the
  following properties from type 'CMSPage': site, locale`.

### 1.9 AGENT_INSTALL.md updates

- Added a *Client components in the registry* subsection under
  Configuration §1 documenting the `'use client'` foot-gun.
- Added a *Post-Install Protocol* top-level section mandating that
  every install produce a `CMS-INSTALL-PROTOCOL.md` at the host repo
  root with two clearly separated sections (this file is the first
  artefact of that mandate).

---

## 2. What still needs manual action

### 2.1 Required before the storefront has any chrome

- **CMS editor — author 3 CMSLayout entities** matching the wrapped
  route groups. Use these `id`s exactly:
  - `default`
  - `reduced`
  - `no-margin`
  Each must expose two slots: `top` and `bottom`. Drop the
  `cms-header` component into `top` and `cms-footer` into
  `bottom` (slot ids are arbitrary — `top` / `bottom` is the
  positional convention used by the layout files; components are
  not constrained by slot name). Configure their props (logo, nav
  items, link columns, social, copyright). Until these CMSLayout
  rows exist, the storefront renders **no chrome at all** — pages
  display only their `main` slot.

- **CMS editor — author the home page.** Create a CMSPage row with
  `slug: home` and at least the `main` slot populated. The home
  route at `/<site>/<locale>/` renders empty until then.

- **CMS editor — author any catch-all pages you want.** Each URL
  under `/<site>/<locale>/<slug>` needs a CMSPage row whose `slug`
  matches the path. URLs without a row 404 with `title: "Page not
  found"`.

- **Emporix Admin → Settings → Component Registries — register the
  storefront's component-registry URL per site.** The endpoint is
  served by [src/app/api/cms/component-registry/route.ts](src/app/api/cms/component-registry/route.ts)
  at `<storefront-origin>/api/cms/component-registry`. Without this
  registration the Emporix CMS MCP server returns an empty catalogue
  to AI agents authoring CMS content. Manual smoke test:
  `curl -i http://localhost:3000/api/cms/component-registry`
  should return `200` with `"$schema": "https://emporix.io/cms/component-registry/v1"`
  in the body.

### 2.2 Env values to confirm or fill in

- `CMS_EDITOR_ORIGINS` (`.env.local`) is currently
  `https://admin.emporix.io`. If your editor lives at a different
  origin (`app.emporix.io`, a staging URL, etc.), set the right
  value or the iframe will be blocked by `frame-ancestors`. Restart
  `next dev` after any change.
- `NEXT_PUBLIC_CMS_EDITOR_API_KEY` is set to a dev value in `.env`.
  Rotate per environment (staging, production) and never commit
  production secrets.
- `CMS_LIVE_PAGE_CACHE_SECONDS` / `CMS_LIVE_LAYOUT_CACHE_SECONDS`:
  override the 60s default if your traffic profile demands it.

### 2.3 Editor follow-up

- Re-pick logos on existing `cms-header` / `cms-footer` instances.
  The logo prop schema changed mid-install from object-form
  (`$ref: 'image'`) to flat `type: 'media'`. Previously saved values
  may not surface in the new picker.

### 2.4 Pre-existing host issues NOT addressed by this install

- `npm install` was not run in this branch. Several baseline
  `tsc --noEmit` errors come from un-installed deps (`pino`,
  `vaul`, `prom-client`) and ungenerated next-intl translation
  JSONs. Running `npm install` and the next-intl generator clears
  them. None are caused by the CMS install.
- The host's DI generator script is named `generate`, not the
  `generate-di` that INSTALLATION.md references. We used
  `npm run generate` throughout. Update the doc upstream when you
  get a chance.

### 2.5 Decisions deferred

- The `(default)` and `(reduced)` route groups are wrapped at the
  layout level but their pages aren't CMS-driven (no
  `EmporixCmsPage`). Decide whether to add catch-all routes for
  those groups too, or keep them host-rendered.
- `cms-product-grid` ships as a placeholder layout — it doesn't
  fetch real product data. A product decorator was deliberately
  not added per the original install scope. When ready, register
  one analogous to the category decorator already in
  `StorefrontCMSComponentDecoratorService`.

### 2.6 Notes for the next agent (or future-you)

- The `CMSNoResult` discriminator is **lowercase** `notfound` — both
  in the type and at runtime. AGENT_INSTALL.md §Page Integration
  documents this explicitly; don't switch it to camelCase.
- Two components are split server/client pairs:
  `gallery.tsx` + `gallery-client.tsx`,
  `newsletter-signup.tsx` + `newsletter-signup-client.tsx`.
  Don't merge them back — `'use client'` modules cannot export
  `CMSComponentEntry` constants without crashing the DI container at
  instrumentation time.
- The shared `image` field's `filename` is `type: 'text'` (manual
  URL paste), not `type: 'media'`. The editor still populates a
  `url` key alongside, and `resolveImageSrc(image)` reads it first
  with `filename` as a fallback. If you want a media picker UI,
  flip `filename` back to `type: 'media'` with
  `allowedTypes: ['image/*']`.
