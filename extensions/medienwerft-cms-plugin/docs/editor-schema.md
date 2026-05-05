# CMS Editor — Schema Migration Notes

Deliverable for the CMS editor team. Describes the schema changes the
storefront now expects, plus the editor-side UX for the new
**ThemeEditor** panel and the `postMessage` contract that drives it.

> **Routing change (breaking):** the CMS plugin no longer exposes any
> HTTP endpoint. The previous `/api/cms/*` and `/api/ext/cms/*` paths
> have been removed. Concretely:
>
> | Old path                       | Replacement |
> |--------------------------------|-------------|
> | `GET  /api/cms?slug=…`         | Removed — the storefront SSR resolves pages directly through `CMSService`; no editor caller is left. |
> | `GET  /api/ext/cms/theme-tokens` | Replaced by the `REQUEST_THEME_TOKENS` ⇄ `THEME_TOKENS_RESPONSE` `postMessage` exchange (see §5). |
> | `POST /api/ext/cms/revalidate` | Removed — shopper-facing reads use a 5-minute fetch-level TTL (`next: { revalidate: 300 }`). Editors never need to invalidate explicitly; published changes propagate within ~5 minutes. |
>
> Why no HTTP at all? Every editor operation that needs live data already
> rides the iframe `postMessage` channel (component types, category
> tree, theme variables, …). Theme tokens follow the same pattern:
> the storefront resolves the manifest during SSR and the live bridge
> answers `REQUEST_THEME_TOKENS` from a closed-over prop — no extra
> route surface, no CORS, no auth-key plumbing.

1. A new attribute on the existing `STOREFRONT_CMS_SETTINGS` entity
   (`site_fallbacks`).
2. A brand-new `STOREFRONT_CMS_THEME` entity with draft / live / archived
   versioning, mirroring the page and layout model.

Plus editor UX notes for the new **ThemeEditor** panel and the live
preview `postMessage` protocol extensions.

---

## 1. Extend `STOREFRONT_CMS_SETTINGS` with `site_fallbacks`

Add one TEXT attribute to the existing `CMS_SETTINGS_DATA` mixin. Keep
the rest of the schema untouched.

```ts
{
  id: 'CMS_SETTINGS_DATA',
  name: { en: 'CMS Settings Data' },
  attributes: [
    // …existing attributes kept as-is…
    {
      key: 'site_fallbacks',
      name: { en: 'Per-site fallbacks' },
      description: {
        en: 'JSON array of { site, fallback_site?, fallback_locale? } entries',
      },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
  ],
  types: ['STOREFRONT_CMS_SETTINGS'],
}
```

### Payload shape

`site_fallbacks` is a JSON-encoded TEXT attribute (matches the
`shop_urls` / `domain_mappings` convention):

```json
{
  "site_fallbacks": [
    { "site": "us-branch", "fallback_site": "main", "fallback_locale": "en" },
    { "site": "main" }
  ]
}
```

### Editor UI rules

- `site` is required and must be a valid site code (enforce the same
  drop-down the storefront's site picker uses).
- `fallback_site` is optional; when set it must be a valid site code
  **other than** `site` (no self-fallback).
- `fallback_locale` is optional; when set it must be a valid locale.
- An entry with only `site` (no fallbacks) is equivalent to "no
  fallback" and should be rejected on save (ask the user to remove the
  row instead).

### Storefront behaviour

- The storefront reads `site_fallbacks` via `CMSSettingsService` and
  applies it **only outside editor mode** (editors must see the real
  `notfound` state for the site they're editing).
- The underlying Emporix read uses `next: { revalidate: 300 }`, so a
  freshly saved settings row is reflected within ~5 minutes for every
  shopper. There is no editor-triggered revalidation — the TTL is the
  contract.

---

## 2. New entity: `STOREFRONT_CMS_THEME`

One row per site with the same draft/live versioning the editor already
uses for pages and layouts.

### 2.1 Schema

```ts
{
  id: 'CMS_THEME_DATA',
  name: { en: 'CMS Theme Data' },
  attributes: [
    {
      key: 'site',
      name: { en: 'Site' },
      description: { en: 'Site code this theme belongs to (unique)' },
      type: 'TEXT',
      metadata: { required: true, nullable: false },
    },
    {
      key: 'base_theme',
      name: { en: 'Base Theme' },
      description: {
        en: 'Optional base theme class name (e.g. "theme-medienwerft") the overrides apply to. Empty = body[data-cms-site]',
      },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
    {
      key: 'variables',
      name: { en: 'Variables' },
      description: {
        en: 'JSON object { "--token": "value", ... } of CSS custom properties',
      },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
    {
      key: 'version',
      name: { en: 'Version' },
      description: { en: 'live | draft | ISO timestamp (archived)' },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
    {
      key: 'base_id',
      name: { en: 'Base ID' },
      description: { en: 'The versionless base id, e.g. cms-theme-main' },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
    {
      key: 'author',
      name: { en: 'Author' },
      description: { en: 'Last editor' },
      type: 'TEXT',
      metadata: { required: false, nullable: true },
    },
  ],
  types: ['STOREFRONT_CMS_THEME'],
}
```

### 2.2 Instance IDs (match pages / layouts)

- **Live:** `cms-theme-<site>` (e.g. `cms-theme-main`).
- **Draft:** `cms-theme-<site>-draft`.
- **Archived:** `cms-theme-<site>-YYYY-MM-DDTHH-MM-SSZ`.

Site is lower-cased in the id (the storefront helper does the same).

### 2.3 `variables` payload

A JSON **object** — not an array — of CSS custom properties:

```json
{
  "--mw-orange": "#ff5500",
  "--mw-black": "#111111",
  "--mw-space-lg": "2rem"
}
```

Validation rules (mirror the storefront sanitizer so the editor rejects
bad input before save — the storefront drops invalid entries silently):

| Field | Regex / constraint |
|-------|--------------------|
| Key   | `^--[a-z0-9][a-z0-9-_]*$` (case-insensitive) |
| Value | `^[^;<>]+$` — no `;`, `<`, `>` |
| Value | Must **not** contain `url(`, `expression(`, `javascript:` |
| Count | Soft cap at 500 entries per theme |

### 2.4 `base_theme`

Optional. When set, the storefront applies the overrides to
`.<base_theme>` (e.g. `theme-medienwerft`). When empty or null, the
overrides target `body[data-cms-site="<site>"]` — the storefront stamps
this attribute automatically, so leaving `base_theme` empty works for
every site without editor intervention.

### 2.5 Migration

- Brand-new entity — no data migration required.
- Storefront gracefully no-ops when no theme row exists (the base theme
  CSS stays the source of truth).
- There is no legacy consumer of theme variables in `STOREFRONT_CMS_SETTINGS`;
  the editor can create theme rows on first save.

---

## 3. ThemeEditor UX

New editor panel. Minimum viable feature set:

1. **Read**
   - `GET STOREFRONT_CMS_THEME/cms-theme-<site>-draft`, fall back to
     `cms-theme-<site>` (live) when no draft exists.
2. **Preview**
   - Open the storefront iframe with `?editMode=true&cmsThemeVersion=draft`.
   - Wait for the storefront's `IFRAME_READY` handshake (already sent by
     the existing component LiveEditor).
   - On every variable edit (colour picker, slider, text input), post
     `UPDATE_THEME_VARIABLES` with the diff (`mode: 'merge'`) to the
     iframe. The storefront patches the CSS without reloading.
   - On **Discard**, post `RESET_THEME_VARIABLES` to roll the iframe
     back to the last server-rendered state.
3. **Persist**
   - **Save draft:** `PUT cms-theme-<site>-draft` against the Emporix
     Custom Entities API. No revalidation call — drafts are only read
     by editor previews, which bypass the storefront cache anyway.
   - **Publish:** copy the draft payload to the live id and delete the
     draft row. Shopper-facing reads use `next: { revalidate: 300 }`,
     so published changes propagate within ~5 minutes without any
     editor-side flush.
   - Debounce network saves to the draft entity (≈1s trailing) — the
     live preview is already handled by `UPDATE_THEME_VARIABLES`.

---

## 4. postMessage protocol (new theme messages)

Added to `CMSEditorMessage`. Types are exported from the extension's
`types.d.ts` — mirror them in the editor codebase.

| Message | Direction | Purpose |
|---------|-----------|---------|
| `REQUEST_THEME` | Editor → Storefront | Ask the storefront for the theme it is currently rendering (answered by `THEME_RESPONSE`). |
| `THEME_RESPONSE` | Storefront → Editor | Reply to `REQUEST_THEME` — contains `site`, `variables`, `target`, `version`. `variables` is the **published baseline merged with the active draft delta** (drafts win on key collision). For purely-current-cascade values consult `REQUEST_THEME_TOKENS.currentValue` instead. |
| `UPDATE_THEME_VARIABLES` | Editor → Storefront | Live preview. `mode: 'merge'` (default) patches, `mode: 'replace'` swaps the whole set. |
| `RESET_THEME_VARIABLES` | Editor → Storefront | Restore the server-rendered state captured on iframe load. |
| `REQUEST_THEME_TOKENS` | Editor → Storefront | Ask the storefront which CSS variables it advertises as overridable (answered by `THEME_TOKENS_RESPONSE`). |
| `THEME_TOKENS_RESPONSE` | Storefront → Editor | Reply to `REQUEST_THEME_TOKENS` — contains `site` and the `manifest` (see §5). |

Example flow:

```text
editor ──IFRAME_READY (existing)──▶ storefront
editor ──UPDATE_THEME_VARIABLES────▶ storefront   (merge: { "--mw-orange": "#ff0000" })
editor ──UPDATE_THEME_VARIABLES────▶ storefront   (merge: { "--mw-orange": "#ff2200" })
editor ──RESET_THEME_VARIABLES─────▶ storefront   (iframe back to live/draft SSR state)
```

The existing `IFRAME_READY` handshake is reused — no new signalling
needed.

> **`site` is optional on `UPDATE_THEME_VARIABLES` and
> `RESET_THEME_VARIABLES`.** A single iframe is scoped to exactly one
> site (the one whose preview is open), so omitting `site` is the
> idiomatic way to mean "this iframe". Pass it explicitly only when
> the editor runs multiple previews side-by-side and wants to make
> sure a stray message can't patch the wrong one — when present it is
> validated against the iframe's site, and mismatches are dropped
> silently.

---

## 5. Token discovery — `REQUEST_THEME_TOKENS` / `THEME_TOKENS_RESPONSE`

The storefront advertises the CSS custom properties editors are
allowed to override. The ThemeEditor asks for this manifest over
`postMessage` (the same channel used for component types and the
category tree) and renders typed controls (colour pickers, length
inputs, selects…) from the response — no HTTP call is involved.

Flow:

```text
editor ──IFRAME_READY (existing)─────▶ storefront
editor ──REQUEST_THEME_TOKENS────────▶ storefront     { requestId?: 'r-1' }
editor ◀──THEME_TOKENS_RESPONSE──────  storefront     { site, manifest, requestId?: 'r-1' }
```

Request payload:

```jsonc
{
  "type": "REQUEST_THEME_TOKENS",
  "requestId": "r-1"
}
```

Response payload (`manifest` is the part the UI cares about):

```jsonc
{
  "type": "THEME_TOKENS_RESPONSE",
  "site": "main",
  "requestId": "r-1",
  "manifest": {
    "site": "main",
    "baseTheme": "theme-medienwerft",
    "groups": [
      {
        "id": "colors",
        "label": "Colors",
        "description": "Semantic colour tokens that propagate across the storefront.",
        "tokens": [
          {
            "name": "--color-primary-500",
            "label": "Primary 500 (action)",
            "description": "Main action / brand colour.",
            "type": "color",
            "defaultValue": "#f99700",
            "currentValue": "#f99700"
          },
          {
            "name": "--mw-orange",
            "label": "Brand — Orange",
            "type": "color",
            "defaultValue": "#f99700",
            "currentValue": "#f99700",
            "advanced": true
          }
        ]
      }
      // …typography, radius, spacing…
    ]
  }
}
```

If the storefront has no `CMSThemeTokenManifestService` bound, the
`manifest` is `{ site, fallback: true, groups: [] }` — a valid
response the editor can detect (`fallback === true`) to fall back to
its generic UI.

### Field semantics

| Field | Purpose |
|-------|---------|
| `name` | CSS variable (must start with `--`). |
| `label` | Human-readable name. |
| `description` | Optional hint shown beneath the control. |
| `type` | `color` / `length` / `number` / `font-family` / `select` / `text`. |
| `defaultValue` | Value from the base theme — used as the reset target. |
| `currentValue` | _Optional._ Live computed value snapshotted by the storefront's bridge from `getComputedStyle(document.body).getPropertyValue(name)` right before sending `THEME_TOKENS_RESPONSE`. Reflects the cascade as the user actually sees it (theme-class overrides + any CMS overrides already applied to the `<style id="cms-theme-override">` node). Editors should display `currentValue ?? defaultValue` for the "applied now" state and keep `defaultValue` as the reset target. Absent when the manifest is resolved outside an editor session. |
| `options` | Required for `type: 'select'`. |
| `aliasOf` | Points at another token whose value this one usually follows. |
| `advanced` | Hide by default in the UI; editors can toggle to reveal. |
| `fallback` (top-level) | `true` means the storefront didn't ship a site-specific list. |

### Examples of overridable tokens

The storefront seeds these for the demo `main` site:

| Token | Type | Default | Effect |
|-------|------|---------|--------|
| `--color-primary-500` | color | `#f99700` | Brand action colour (buttons, links, focus). |
| `--color-primary-700` | color | `#ea580c` | Action hover / active state. |
| `--color-text-headings` | color | `#000000` | All `h1`–`h6`. |
| `--color-text-body` | color | `#000000` | Paragraph / inline text. |
| `--color-surface-page` | color | `#ffffff` | `<body>` background. |
| `--color-surface-action` | color | `#f99700` | Solid fill for primary CTAs. |
| `--color-border-primary` | color | `#edefef` | Default border colour. |
| `--font-primary` | font-family | `Today Sans, Helvetica Neue, Arial, sans-serif` | Default text stack. |
| `--border-radius-button` | length | `0` | Global button rounding. |
| `--border-radius-form-field` | length | `0` | Global input rounding. |
| `--spacing-4` | length | `1rem` | Medium spacing step; cascades into components. |

### Extending / overriding the manifest

The manifest is **generic** — the storefront owns the list, the
extension owns the format. To advertise your own tokens, register a
class implementing `CMSThemeTokenManifestService` (see
`src/platform/services/cms/impl/StorefrontCMSThemeTokenManifestService.ts`
for the reference implementation). The extension will pick it up via
the `plugin.json` alias:

```jsonc
{
  "aliases": {
    "CMSThemeTokenManifestService": "StorefrontCMSThemeTokenManifestService"
  }
}
```

If no implementation is bound, the storefront answers
`REQUEST_THEME_TOKENS` with the extension's empty default
(`fallback: true`, `groups: []`) — safe to ship, the editor just shows
no tokens.

---

## 6. Caching & propagation

There is no editor-triggered cache revalidation. The storefront keeps
its data fresh via fetch-level TTLs:

| Read | TTL | Mechanism |
|------|-----|-----------|
| CMS theme (live) | 5 min | `next: { revalidate: 300 }` on the Emporix Custom Entity fetch in `EmporixCmsThemeApi`. |
| CMS settings | 5 min | `next: { revalidate: 300 }` on the Emporix Custom Entity fetch in `EmporixCmsSettingsApi`. |
| CMS pages / layouts | unchanged | Existing per-page caching in `EmporixCMSService`. |

Editors publish; shoppers see the change within ~5 minutes. Live
previews bypass this layer entirely — see §7.

---

## 7. Theme stylesheet wiring

The persisted theme is delivered to the storefront as a **real CSS
resource** rather than an inline `<style>`:

- A route handler at `app/[site]/cms-theme.css/route.ts` serves the
  current theme, content-typed `text/css`. URL shape:
  `/<site>/cms-theme.css?v=<version>`.
- The root layout emits `<link rel="stylesheet" href=".../cms-theme.css?v=..." precedence="cms-theme">`.
  React 19 hoists the `<link>` into `<head>` and dedupes by `href`.
- `?v=` is the `theme.version` from the persisted row — a publish bump
  changes the URL, so browsers and CDNs refetch fresh CSS without any
  server-side cache busting. Versioned URLs ship with
  `Cache-Control: public, max-age=31536000, immutable`; the
  unversioned fallback uses `s-maxage=10, stale-while-revalidate=60`
  to mirror the upstream theme TTL.

In editor mode the live bridge additionally creates a draft `<style>`
element and appends it to `<head>` **after** the `<link>`. The bridge
identifies its own draft via the marker attribute
`data-cms-theme-draft="<site>"`. All `UPDATE_THEME_VARIABLES` /
`UPDATE_THEME_TARGET` patches are written into this draft node — the
`<link>` is **never** mutated. `RESET_THEME_VARIABLES` empties the
draft so the published `<link>` values shine through the cascade,
matching what a freshly loaded shopper page would render.
