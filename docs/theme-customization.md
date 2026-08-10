# Theme Customization Guide

**Audience:** brand owners and site operators who want to re-skin a storefront site — change its
colours, accents, and surfaces — **without** needing to understand the internals of the design
system. If you want to know *how* the theming machinery works under the hood (token layers,
cascade order, architectural boundaries), read [`styling-and-theming.md`](./styling-and-theming.md)
instead.

## Table of Contents

- [What a theme is](#what-a-theme-is)
- [What you can change](#what-you-can-change)
- [Recipe: theme a site](#recipe-theme-a-site)
- [Default behaviour](#default-behaviour)
- [Going deeper](#going-deeper)

## What a theme is

The storefront is **multi-tenant**: each site is mounted under its own route segment (e.g. `/main`,
`/us-branch`, `/showcase`). A *theme* is a small stylesheet that overrides a handful of design
tokens **for one site only** — typically its action colours. Everything else (layout, typography,
spacing, components) stays shared across all sites.

Two things to keep in mind:

- A theme **overrides existing tokens** — it does not introduce new design decisions or new
  component styles. You re-point a variable; the whole UI re-skins automatically.
- Theming is **independent of the CMS.** A site keeps its brand even if it runs without any CMS
  provider — you do not need Storyblok or any content system to give a site its own look.

## What you can change

A theme overrides **existing** context tokens (defined in `src/app/styles/mapped.css`). The most
useful ones for re-branding:

| Group           | Token                              | Controls                                  |
|-----------------|------------------------------------|-------------------------------------------|
| Action surface  | `--color-surface-action`           | Primary button / call-to-action background |
|                 | `--color-surface-action-hover`     | …its hover state                          |
| Action text     | `--color-text-action`              | Links and action text                     |
|                 | `--color-text-on-action`           | Text/label on a coloured action surface   |
| Body & headings | `--color-text-body`                | Default body text                         |
|                 | `--color-text-headings`            | Headings                                  |
| Borders & focus | `--color-border-action`            | Action element borders                    |
|                 | `--color-border-focus`             | Focus ring                                |
| Corners         | `--border-radius-button`           | Button corner radius                      |

> See `src/app/styles/mapped.css` for the full list of context tokens. **Only override tokens that
> already exist** — do not invent new token names in a theme file. (A genuinely new design token has
> to be added to the shared layers first; that is a frontend-developer task covered in
> [`styling-and-theming.md`](./styling-and-theming.md#extending-the-theme).)

## Recipe: theme a site

### 1. Create the theme file

Add `public/themes/<site-code>.css` containing **only** `:root` overrides for the tokens you want to
change. Example (hypothetical site accent — registered demo sites currently ship empty files so they
keep the shared `mapped.css` defaults):

```css
:root {
  --color-surface-action: var(--color-primary-500);
  --color-surface-action-hover: var(--color-primary-700);
}
```

Prefer `var(--…)` chains that match `mapped.css` / `brand.css` when you only want the shared palette.
Literal hex/OKLCH overrides are fine when a site must diverge. Either way, re-pointing these tokens
re-skins every action surface (buttons, focus rings, …); the rest of the design stays shared.

### 2. Register the site

Add the site to `THEME_MAP` in `src/app/styles/themes/index.ts`:

```ts
export const THEME_MAP: Readonly<Record<string, string>> = {
  main: '/themes/main.css',
  'us-branch': '/themes/us-branch.css',
  showcase: '/themes/showcase.css',
  // 'my-new-site': '/themes/my-new-site.css',
};
```

### 3. Verify in the browser

Navigate to `/<site-code>` and confirm the new look. To double-check a specific token, open dev
tools and inspect a sample action element:

```js
getComputedStyle(document.querySelector('button')).backgroundColor
// → should report your per-site value
```

## Default behaviour

A site that is **not** listed in `THEME_MAP` automatically falls back to `public/themes/_default_.css`,
which is intentionally empty. So an un-themed site simply shows the neutral storefront look — it
never accidentally inherits another site's colours, and there is no manual opt-out to remember.

## Going deeper

This guide covers the *what* and the *how-to*. For the *why* — the layered token architecture, the
cascade order that makes per-site overrides win, and the architectural boundaries that keep the
theme layer decoupled from data sources — see
[`styling-and-theming.md`](./styling-and-theming.md#per-site-theming).
