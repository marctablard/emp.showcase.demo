# Styling and Theming Guide

**Audience:** frontend developers. This document explains the **mechanics** of the storefront design
system — how it defines, composes, and consumes visual tokens. Follow these guidelines to keep the
UI consistent with the brand and to simplify future theme adjustments.

> If you only want to **re-skin a site** (change its colours/accents) without learning the internals,
> read [`theme-customization.md`](./theme-customization.md) instead — it is the recipe-level guide.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Token Architecture](#token-architecture)
  - [`src/app/styles/brand.css`](#srcappstylesbrandcss)
  - [`src/app/styles/alias.css`](#srcappstylesaliascss)
  - [`src/app/styles/mapped.css`](#srcappstylesmappedcss)
  - [`src/app/globals.css`](#srcappglobalscss)
- [Tailwind Integration](#tailwind-integration)
- [Usage Guidelines](#usage-guidelines)
- [Working with Components and Pages](#working-with-components-and-pages)
- [Extending the Theme](#extending-the-theme)
- [Per-Site Theming](#per-site-theming)
- [References](#references)

## Technology Stack

- **Tailwind CSS** powers all styling. Tailwind utilities are available, but the default palettes, typography, radii, shadows, fonts, and font weights are overridden by our own token set.
- **Design Tokens** live in layered CSS files that are imported globally. Each layer progressively maps raw brand values to semantic, context-aware tokens.
- **Next.js Global Styles** in `src/app/globals.css` load the full token graph and expose utilities that components can use.

## Token Architecture

The design tokens flow from foundational values to context-specific tokens. Every layer imports the previous one, so updates cascade forward without touching component code.

### `src/app/styles/brand.css`

- **Purpose**: Store raw brand decisions such as base colors, scales, typography, spacing, and font families.
- **Content**: OKLCH color definitions for blues, teals, greens, oranges, reds, greys, plus spacing scales like `--scale-400-16`. Fonts and font weights are registered inside a `@theme` block.
- **Usage**: Treat these variables as the single source of truth for brand primitives; do not reference them directly in components.

### `src/app/styles/alias.css`

- **Purpose**: Map brand primitives to semantic aliases (primary, success, warning, neutral, spacing sizes, etc.).
- **Content**: Aliases such as `--color-primary-500` or `--spacing-4` wrap the values from `brand.css` to describe intent rather than a hexadecimal value.
- **Usage**: Allows designers to rename color families or adjust scales while keeping downstream references stable.

### `src/app/styles/mapped.css`

- **Purpose**: Translate semantic aliases into Figma-aligned context tokens for text, surfaces, icons, borders, gradients, radii, and typography scales for mobile and desktop.
- **Content**: Variables like `--color-text-body`, `--color-surface-action`, or `--border-width-md` reference the aliases. Context tokens cover both light-surface usage and interaction states.
- **Usage**: Templates and components should rely on these tokens via Tailwind utilities. Example:
  ```css
  /* src/app/styles/mapped.css */
  :root {
    --color-surface-action: var(--color-primary-500);
    --color-text-on-action: var(--color-white);
  }
  ```

### `src/app/globals.css`

- **Purpose**: Compose all layers, expose Tailwind theme overrides, and set base styles.
- **Key Responsibilities**:
  - Imports `brand.css`, `alias.css`, and `mapped.css`.
  - Defines responsive typography tokens (`--token-text-sm`, etc.) that Tailwind consumes through `@theme inline`.
  - Sets global utilities such as `.border-width-*` and base selectors to apply font stacks and default text/background context tokens.

## Tailwind Integration

Our Tailwind configuration reads the variables exposed in `globals.css`. When you reference Tailwind classes like `bg-surface-action` or `text-text-body`, Tailwind resolves them to the mapped context tokens.

- **Overridden Defaults**: Default Tailwind palettes, font stacks, radii, shadows, font weights, and typography scales are replaced by our tokens. Using stock Tailwind names (e.g., `bg-blue-500`) circumvents the design system.
- **Context Tokens in Classes**: Tailwind utilities point to CSS variables defined in the token layers. All UI code must use these context-aware classes rather than raw color names or values.
- **Dark Mode Placeholder**: The `.dark` block in `globals.css` prepares room for alternative palettes. Adjust or extend context tokens there if a dark theme is required.

## Usage Guidelines

- **Do** reference context tokens such as `bg-surface-action`, `text-text-body`, `border-border-primary`, or `shadow-xl` inside JSX/TSX templates and component styles.
- **Do** rely on the Figma design system naming. The context token names in the code base mirror the Figma tokens.
- **Do** prefer semantic intent when picking utilities (e.g., `text-text-success` for positive feedback).
- **Do Not** use raw Tailwind palette utilities like `bg-primary-500` or custom hex values in components.
- **Do Not** reach into `brand.css` or `alias.css` from templates. Let the mapping layer handle updates.

## Working with Components and Pages

- **Server and Client Components** should import Tailwind classes that wrap context tokens. Example in JSX:
  ```tsx
  <button className="bg-surface-action hover:bg-surface-action-hover text-text-on-action rounded-md px-4 py-2" aria-label="Confirm action" tabIndex={0}>
    Confirm
  </button>
  ```
- **Custom Utilities** can be defined via `@layer utilities` in `globals.css` if they express reusable patterns (e.g., `.border-width-*`). Ensure they reference existing tokens.
- **Layout Containers** can use custom container variables (`--container-6xl`, `--container-7xl`) through Tailwind utilities if configured.

## Extending the Theme

Follow these steps when adding or updating tokens:

1. **Add brand primitive** in `brand.css`. For example, introduce a new color scale or spacing size.
2. **Map to aliases** in `alias.css`. Give the primitive a semantic name that expresses use (e.g., `--color-highlight-500`).
3. **Expose context token** in `mapped.css`. Decide which UI context should consume the alias and reference the variable there.
4. **Expose Tailwind utility** in `globals.css`. Extend the `@theme inline` block or add utilities so Tailwind can resolve the token.
5. **Verify in Figma** that the naming and usage align with the design file. Designers should see consistent token names across tools.

## Per-Site Theming

The storefront is multi-tenant: each tenant is mounted under its own `[site]` route segment (e.g. `/main`, `/us-branch`, `/showcase`) and can ship a small stylesheet that overrides selected design tokens for that tenant only. The bulk of the design system stays shared — per-site themes are intentionally **token overrides**, not parallel component libraries.

The mechanism is orthogonal to the CMS framework: it stays active even if the active `CMSService` provider is `none`, and a CMS-less site can still carry its own brand.

### Pieces

- **`public/themes/<site-code>.css`** — a static stylesheet served by Next from `public/`. Contains only `:root` overrides on existing token variables (`--color-surface-action`, `--color-text-body`, …). Loaded via a regular `<link rel="stylesheet">` so it sits outside the JS bundle.
- **`public/themes/_default_.css`** — the neutral fallback file. Deliberately empty (or near-empty); a site without an explicit theme inherits it instead of accidentally cascading another tenant's overrides.
- **`src/app/styles/themes/index.ts`** — pure registry: `THEME_MAP` maps a site code to its public href, and `resolveThemeForSite(siteCode)` returns the matching href or `DEFAULT_THEME_HREF` when the site is unknown.
- **`src/components/theme/site-theme-style.tsx`** — Server Component that renders the resolved `<link>`. Mounted as the FIRST `<body>` child in `[site]/[locale]/layout.tsx`, so it loads *after* `globals.css` (which is injected into `<head>`) and therefore wins the cascade for the `:root` token overrides it carries.

### Cascade order

```
brand.css → alias.css → mapped.css → globals.css   (shared, in <head>)
                                       └─ public/themes/<site>.css   (per-site, first <body> child)
```

Per-site files override only the tokens they explicitly redefine; everything else stays inherited.

### Adding a theme for a new site

The step-by-step recipe for adding a site theme lives in
[`theme-customization.md`](./theme-customization.md#recipe-theme-a-site) — that is the
operator-facing guide. This section explains *why* that recipe works: a per-site file is a static
stylesheet of `:root` overrides, loaded as the first `<body>` child so it wins the cascade for equal
specificity (see [Cascade order](#cascade-order)), and a site absent from `THEME_MAP` falls back to
the empty `_default_.css` — safe by construction, no manual opt-out needed.

### Boundaries (ADR-0001)

The theme layer is a leaf with zero coupling to data sources:

- `themes/index.ts` and `SiteThemeStyle` MUST NOT import from `@/platform/integrations/*`, any DI container, or any provider context.
- Per-site CSS files MUST NOT introduce new token *names* — they only override existing ones from `brand.css` / `alias.css` / `mapped.css`. A new token always starts in the shared layers first.

A drift-guard test (`src/components/theme/theme-layer-provider-agnostic.drift.test.ts`) pins the boundary.

## References

- **Tailwind CSS Documentation**: https://tailwindcss.com/docs
- **Design Tokens**: `src/app/styles/brand.css`, `src/app/styles/alias.css`, `src/app/styles/mapped.css`, `src/app/globals.css`
- **Per-Site Theming**: `src/app/styles/themes/index.ts`, `src/components/theme/site-theme-style.tsx`, `public/themes/`
- **Theme Customization (operator-facing recipe)**: [`theme-customization.md`](./theme-customization.md)
- **Design Source**: Figma storefront design system (context tokens mirror Figma naming)
- **ADR-0001**: CMS providers integrated solely through adapters (theme layer is a leaf, no provider coupling)

## Related Documentation

- [Documentation index](./README.md)
- [UI Components](./ui-components.md)
- [Rendering: SSR / SSG / ISR](./rendering-ssr-ssg-isr.md)
- [Project Structure](./project-structure.md)
