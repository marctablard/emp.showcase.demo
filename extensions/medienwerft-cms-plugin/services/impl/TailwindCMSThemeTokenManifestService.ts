import { injectable } from '@/platform/core/di/injectable';
import type {
  CMSThemeTokenManifestService,
  ThemeTokenGroup,
  ThemeTokenManifest,
} from '../CMSThemeTokenManifestService';

/**
 * Default manifest for storefronts built on the **Emporix Tailwind v4
 * design system** — the three-layer token cascade (`brand.css` →
 * `alias.css` → `mapped.css`) shipped by the reference storefront at
 * `emporix-showcase`. New Emporix Tailwind projects start from that
 * template, so the same token names apply.
 *
 * The cascade:
 *  - `brand.css` declares the raw palette (`--color-blue-500`,
 *    `--color-grey-900`, …) plus a numeric scale (`--scale-100-4` =
 *    `0.25rem`, …).
 *  - `alias.css` re-exposes the palette under semantic names
 *    (`--color-primary-500 = var(--color-blue-500)`,
 *    `--color-secondary-500 = var(--color-teal-500)`,
 *    `--color-success-500`, `--color-error-500`, …) plus a named
 *    spacing / radius / border-width scale.
 *  - `mapped.css` composes **context tokens** from those semantic
 *    names (`--color-text-action = var(--color-primary-500)`,
 *    `--color-surface-action = var(--color-primary-500)`,
 *    `--border-radius-button = var(--border-radius-sm)`, …). This is
 *    where reskinning happens in practice: editing a single alias
 *    (e.g. `--color-primary-500`) propagates through every context
 *    token that references it.
 *  - `globals.css` wires those context tokens into Tailwind v4's
 *    `@theme inline` block, after explicitly zeroing Tailwind's stock
 *    palette (`--color-*: initial`). That means tokens like
 *    `--color-blue-500` — Tailwind's own defaults — are **not**
 *    present in the cascade; editing them would be a no-op.
 *
 * The manifest therefore exposes:
 *  - **Primary / secondary scales** (two most-overridden stops) — the
 *    top-leverage edits. Changing `--color-primary-500` alone
 *    retints every "action" surface and focus ring across the
 *    storefront.
 *  - **Context tokens** for text, surface, border, icon — the second
 *    dial, for cases where the operator wants a different primary
 *    shade on buttons vs. links.
 *  - **Status scales** (success / warning / error / information) as
 *    `advanced` — rarely reskinned but worth being reachable.
 *  - **Palette swatches** (`--color-blue-500`, `--color-teal-500`,
 *    …) as `advanced` — editing these is how you'd also retint the
 *    primary scale that aliases them.
 *  - **Typography, radius, spacing, shadow** using the actual source-
 *    of-truth variable names (`--font-primary`, `--border-radius-*`,
 *    `--spacing-1`, `--theme-shadow-*`) — not their Tailwind-namespace
 *    aliases (`--radius-*`, `--font-sans`, …), which are only one-way
 *    mirrors and can't be edited independently.
 *
 * Storefronts that depart from this cascade should register their own
 * `CMSThemeTokenManifestService` — see
 * `src/platform/services/cms/impl/StorefrontCMSThemeTokenManifestService.ts`
 * for a project-specific example.
 *
 * **Defaults** below match `brand.css` / `alias.css` / `mapped.css` as
 * shipped by the reference storefront. They are advisory — the live
 * bridge enriches each token with its actual computed `currentValue`
 * at `REQUEST_THEME_TOKENS` time, so if a `.theme-<name>` class
 * overrides a default the editor sees the live value regardless.
 */

const COLOR_GROUP: ThemeTokenGroup = {
  id: 'tw-colors',
  label: 'Colors',
  description:
    'Semantic colour tokens from the Emporix Tailwind design system. Editing a scale stop (`--color-primary-500`) retints every context token that references it (surface-action, text-action, border-focus, …).',
  tokens: [
    // Primary scale — the single highest-leverage edit. Default is
    // `--color-blue-500` / `-700` via alias.css.
    {
      name: '--color-primary-500',
      label: 'Primary 500 (action)',
      description:
        'Main action / brand colour. Cascades through `--color-surface-action`, `--color-text-action`, `--color-border-focus`, `--color-icon-action`, …',
      type: 'color',
      defaultValue: 'oklch(0.5701 0.1725 253.49)',
    },
    {
      name: '--color-primary-700',
      label: 'Primary 700 (hover)',
      description:
        'Darker shade for hover / active states. Drives `--color-surface-action-hover`, `--color-text-action-hover`, `--color-border-action-hover`.',
      type: 'color',
      defaultValue: 'oklch(0.3965 0.1149 252.87)',
    },
    {
      name: '--color-primary-50',
      label: 'Primary 50 (tint)',
      description: 'Very light primary tint used as `--color-surface-action-hover-2` (secondary hover fill).',
      type: 'color',
      defaultValue: 'oklch(0.9536 0.0172 248.01)',
      advanced: true,
    },
    // Secondary scale — default is teal via alias.css.
    {
      name: '--color-secondary-500',
      label: 'Secondary 500',
      description: 'Secondary brand colour. Drives `--color-surface-secondary` and `--color-border-secondary`.',
      type: 'color',
      defaultValue: 'oklch(0.8852 0.1348 156.84)',
    },
    {
      name: '--color-secondary-700',
      label: 'Secondary 700',
      type: 'color',
      defaultValue: 'oklch(0.6058 0.0883 157.43)',
      advanced: true,
    },
    // Context tokens — the second dial. These are the variables
    // shadcn-style components consume directly.
    {
      name: '--color-surface-action',
      label: 'Surface — action',
      description:
        'Fill colour for primary buttons / CTAs. Defaults to `--color-primary-500` — override only if you want buttons to diverge from the primary scale.',
      type: 'color',
      defaultValue: 'oklch(0.5701 0.1725 253.49)',
      aliasOf: '--color-primary-500',
    },
    {
      name: '--color-surface-page',
      label: 'Surface — page',
      description: 'Page-level background; applied on `<body>`.',
      type: 'color',
      defaultValue: 'oklch(1 0 0)',
    },
    {
      name: '--color-text-headings',
      label: 'Text — headings',
      description: 'Default colour for h1–h6.',
      type: 'color',
      defaultValue: 'oklch(0.2234 0.0058 285.92)',
    },
    {
      name: '--color-text-body',
      label: 'Text — body',
      description: 'Default paragraph / inline text colour.',
      type: 'color',
      defaultValue: 'oklch(0.3381 0.0105 278.28)',
    },
    {
      name: '--color-text-on-action',
      label: 'Text — on action',
      description: 'Text / icon colour rendered on top of `--color-surface-action` (e.g. button labels).',
      type: 'color',
      defaultValue: 'oklch(1 0 0)',
    },
    {
      name: '--color-border-primary',
      label: 'Border — primary',
      description: 'Default border colour for cards, inputs, separators.',
      type: 'color',
      defaultValue: 'oklch(0.8586 0.0083 278.62)',
    },
    {
      name: '--color-border-focus',
      label: 'Border — focus ring',
      description: 'Accessible focus ring colour. Defaults to `--color-primary-500`.',
      type: 'color',
      defaultValue: 'oklch(0.5701 0.1725 253.49)',
      aliasOf: '--color-primary-500',
    },
    // Status scales — advanced.
    {
      name: '--color-success-500',
      label: 'Success 500',
      type: 'color',
      defaultValue: 'oklch(0.548 0.1741 144.13)',
      advanced: true,
    },
    {
      name: '--color-warning-500',
      label: 'Warning 500',
      type: 'color',
      defaultValue: 'oklch(0.5825 0.1717 42.53)',
      advanced: true,
    },
    {
      name: '--color-error-500',
      label: 'Error 500',
      type: 'color',
      defaultValue: 'oklch(0.5093 0.2032 28.63)',
      advanced: true,
    },
    {
      name: '--color-information-500',
      label: 'Information 500',
      type: 'color',
      defaultValue: 'oklch(0.7912 0.111 248.26)',
      advanced: true,
    },
    // Raw palette swatches — advanced. These are what the `primary` /
    // `secondary` aliases ultimately resolve to.
    {
      name: '--color-blue-500',
      label: 'Palette — Blue 500',
      type: 'color',
      defaultValue: 'oklch(0.5701 0.1725 253.49)',
      advanced: true,
    },
    {
      name: '--color-teal-500',
      label: 'Palette — Teal 500',
      type: 'color',
      defaultValue: 'oklch(0.8852 0.1348 156.84)',
      advanced: true,
    },
    {
      name: '--color-grey-500',
      label: 'Palette — Grey 500',
      type: 'color',
      defaultValue: 'oklch(0.6326 0.0227 276.74)',
      advanced: true,
    },
    {
      name: '--color-white',
      label: 'Palette — White',
      type: 'color',
      defaultValue: 'oklch(1 0 0)',
      advanced: true,
    },
    {
      name: '--color-black',
      label: 'Palette — Black',
      type: 'color',
      defaultValue: 'oklch(0 0 0)',
      advanced: true,
    },
  ],
};

/**
 * Source-of-truth font variables. `--font-headlines` /
 * `--font-body` in `globals.css` just alias these through
 * Tailwind's `@theme` namespace — editing the aliases directly
 * wouldn't propagate, so the manifest exposes the sources.
 */
const TYPOGRAPHY_GROUP: ThemeTokenGroup = {
  id: 'tw-typography',
  label: 'Typography',
  description:
    'Font-family stacks. `--font-primary` drives headlines via `--font-headlines`; `--font-secondary` drives body copy via `--font-body`.',
  tokens: [
    {
      name: '--font-primary',
      label: 'Primary font (headlines)',
      type: 'font-family',
      defaultValue: 'Ubuntu, sans-serif',
    },
    {
      name: '--font-secondary',
      label: 'Secondary font (body)',
      type: 'font-family',
      defaultValue: 'Open sans, sans-serif',
    },
  ],
};

/**
 * Radius tokens use the **source-of-truth** names (`--border-radius-*`)
 * rather than Tailwind's `--radius-*` aliases — the latter are
 * one-way mirrors declared inside `@theme inline { }` that read from
 * `--border-radius-*`, so editing `--radius-sm` at `.theme-<name>`
 * scope would be a no-op (Tailwind recomputes from the source).
 */
const RADIUS_GROUP: ThemeTokenGroup = {
  id: 'tw-radius',
  label: 'Corner radius',
  description:
    "`--border-radius-*` is the source-of-truth scale; Tailwind's `--radius-*` utilities alias it. Context tokens (`--border-radius-button`, `--border-radius-form-field`) pick specific steps.",
  tokens: [
    {
      name: '--border-radius-sm',
      label: 'Small',
      type: 'length',
      defaultValue: '0.25rem',
    },
    {
      name: '--border-radius-md',
      label: 'Medium',
      type: 'length',
      defaultValue: '0.5rem',
    },
    {
      name: '--border-radius-lg',
      label: 'Large',
      type: 'length',
      defaultValue: '1rem',
    },
    {
      name: '--border-radius-button',
      label: 'Buttons',
      description: 'Applied to every `rounded-button` utility. Defaults to `--border-radius-sm`.',
      type: 'length',
      defaultValue: '0.25rem',
      aliasOf: '--border-radius-sm',
    },
    {
      name: '--border-radius-form-field',
      label: 'Form fields',
      type: 'length',
      defaultValue: '0.25rem',
      aliasOf: '--border-radius-sm',
    },
    {
      name: '--border-radius-pills',
      label: 'Pills',
      type: 'length',
      defaultValue: '0.25rem',
      aliasOf: '--border-radius-sm',
      advanced: true,
    },
    {
      name: '--border-radius-xl',
      label: 'Extra large',
      type: 'length',
      defaultValue: '1.5rem',
      advanced: true,
    },
  ],
};

/**
 * The showcase design system uses a named scale (`--spacing-1` …
 * `--spacing-16`) aliased from a `--scale-*` numeric scale.
 * `--spacing-1` doubles as Tailwind v4's `--spacing` base, so every
 * `p-*` / `m-*` / `gap-*` utility reads from it via `calc(--spacing *
 * N)`.
 */
const SPACING_GROUP: ThemeTokenGroup = {
  id: 'tw-spacing',
  label: 'Spacing',
  description:
    "Named spacing steps (source-of-truth). `--spacing-1` doubles as Tailwind v4's `--spacing` base — tweaking it proportionally rescales every `p-*` / `m-*` / `gap-*` utility.",
  tokens: [
    {
      name: '--spacing-1',
      label: 'Spacing 1 (base / xs)',
      description:
        "0.25 rem by default. Doubles as Tailwind's `--spacing` base — bumping this rescales every spacing utility site-wide.",
      type: 'length',
      defaultValue: '0.25rem',
    },
    {
      name: '--spacing-2',
      label: 'Spacing 2 (sm)',
      type: 'length',
      defaultValue: '0.5rem',
    },
    {
      name: '--spacing-4',
      label: 'Spacing 4 (md)',
      type: 'length',
      defaultValue: '1rem',
    },
    {
      name: '--spacing-8',
      label: 'Spacing 8 (xl)',
      type: 'length',
      defaultValue: '2rem',
      advanced: true,
    },
    {
      name: '--spacing-16',
      label: 'Spacing 16 (2xl)',
      type: 'length',
      defaultValue: '4rem',
      advanced: true,
    },
  ],
};

/**
 * Shadows are composite `--theme-shadow-*` values built from spacing
 * and transparent-neutral tints in `globals.css`. Exposing them as
 * `text` so operators can hand-author new stacks; raw transparent
 * anchors live under the colour group.
 */
const SHADOW_GROUP: ThemeTokenGroup = {
  id: 'tw-shadow',
  label: 'Elevation (shadows)',
  description:
    "`--theme-shadow-*` drives Tailwind's `shadow-*` utilities via `@theme inline`. Usually safe to leave alone.",
  tokens: [
    {
      name: '--theme-shadow-sm',
      label: 'Shadow sm',
      type: 'text',
      defaultValue:
        '0 0.0625rem 0.75rem 0.0625rem oklch(0.2234 0.0058 285.92 / 5%), 0 0.125rem 0.5rem 0.125rem oklch(0.2234 0.0058 285.92 / 10%)',
      advanced: true,
    },
    {
      name: '--theme-shadow-md',
      label: 'Shadow md',
      type: 'text',
      defaultValue:
        '0 0.0625rem 0.75rem 0 oklch(0.2234 0.0058 285.92 / 5%), 0 0.25rem 0.5rem 0.25rem oklch(0.2234 0.0058 285.92 / 10%)',
      advanced: true,
    },
    {
      name: '--theme-shadow-lg',
      label: 'Shadow lg',
      type: 'text',
      defaultValue:
        '0 0.0625rem 0.75rem 0 oklch(0.2234 0.0058 285.92 / 10%), 0 0.5rem 0.75rem 0.5rem oklch(0.2234 0.0058 285.92 / 10%)',
      advanced: true,
    },
  ],
};

const MANIFEST_GROUPS: ThemeTokenGroup[] = [COLOR_GROUP, TYPOGRAPHY_GROUP, RADIUS_GROUP, SPACING_GROUP, SHADOW_GROUP];

/**
 * Default manifest provider for Emporix Tailwind v4 storefronts.
 *
 * Registered under its own DI id so it co-exists with
 * {@link DefaultCMSThemeTokenManifestService} (the empty-fallback
 * variant) and any project-specific
 * `StorefrontCMSThemeTokenManifestService`. Activate via the
 * `plugin.json` alias:
 *
 *     "CMSThemeTokenManifestService": "TailwindCMSThemeTokenManifestService"
 *
 * Not site-aware — returns the same defaults for every site code.
 * Per-site palettes should subclass this service or register a bespoke
 * manifest.
 *
 * Returned manifests carry `fallback: true` so the editor can label
 * them as "generic Emporix Tailwind defaults" and prompt the operator
 * to register a project-specific manifest when richer role semantics
 * matter.
 */
@injectable('TailwindCMSThemeTokenManifestService', 'Singleton')
export class TailwindCMSThemeTokenManifestService implements CMSThemeTokenManifestService {
  async getManifest(site: string): Promise<ThemeTokenManifest | null> {
    return {
      site,
      fallback: true,
      groups: MANIFEST_GROUPS,
    };
  }
}

export default TailwindCMSThemeTokenManifestService;
