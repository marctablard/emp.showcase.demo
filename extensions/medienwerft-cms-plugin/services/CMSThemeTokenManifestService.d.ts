/**
 * Describes the CSS custom properties a storefront is willing to let
 * the CMS editor override. The manifest travels to the editor over
 * the iframe `postMessage` channel — the storefront resolves it
 * during SSR, hands it to the live bridge as a prop, and the bridge
 * answers `REQUEST_THEME_TOKENS` with `THEME_TOKENS_RESPONSE`. There
 * is no HTTP endpoint for theme tokens.
 *
 * The manifest is **advisory**: the storefront's sanitizer in
 * `EmporixCMSThemeService` still validates every saved value, and
 * editors can persist tokens that aren't listed here (e.g. custom
 * experimentation). Listing a token just opts it into the visual UI
 * and gives the editor sensible defaults / previews.
 */

/**
 * Control hint for the editor. The default renderer is a free-form
 * text input; specific types unlock richer widgets.
 *
 * - `color`: color picker. `defaultValue` should be a CSS color
 *   (hex / rgb / hsl / oklch / named).
 * - `length`: numeric input + unit selector (rem, px, em, %). The
 *   editor validates against a CSS length grammar.
 * - `number`: raw numeric input (for unitless values like
 *   line-height or font-weight).
 * - `font-family`: font-family text input with autocomplete against
 *   the storefront's advertised font stack.
 * - `select`: dropdown constrained to `options`. Values are stored
 *   verbatim — the manifest is responsible for supplying CSS-valid
 *   strings (e.g. `"0"`, `"0.25rem"`).
 * - `text`: free-form string. Use for shadows, gradients (if allowed),
 *   transforms, etc.
 */
export type ThemeTokenType = 'color' | 'length' | 'number' | 'font-family' | 'select' | 'text';

export interface ThemeTokenOption {
  label: string;
  value: string;
}

/**
 * A single overridable CSS custom property.
 */
export interface ThemeToken {
  /** The CSS variable name, including the leading `--`. */
  name: string;
  /** Human-readable label shown in the editor UI. */
  label: string;
  /** Short description — purpose, usage rules, "don't touch"s. */
  description?: string;
  /** Control hint; see {@link ThemeTokenType}. */
  type: ThemeTokenType;
  /**
   * Value the storefront ships with — i.e. what the variable resolves
   * to with no CMS overrides applied. Optional in source data: the
   * live bridge populates it dynamically at `REQUEST_THEME_TOKENS`
   * time by reading `getComputedStyle` with the persisted-theme
   * `<link>` and the bridge's draft `<style>` momentarily disabled.
   * That reading reflects whatever the static CSS cascade actually
   * produces (including `.theme-<name>` overrides), so a manifest
   * that omits this field still yields a meaningful baseline in the
   * editor — and one that tracks the real CSS files instead of a
   * hand-maintained mirror that can silently drift.
   */
  defaultValue?: string;
  /**
   * Live computed value read from the storefront DOM at
   * `REQUEST_THEME_TOKENS` time. Populated by the live bridge via
   * `getComputedStyle(document.body).getPropertyValue(name)` so the
   * editor reflects whatever the cascade actually produces — including
   * theme-class overrides (e.g. `.theme-medienwerft` redefining
   * Tailwind's default `--color-*` tokens) and any CMS overrides
   * already applied through the `<style id="cms-theme-override">`
   * node.
   *
   * Absent when the manifest is resolved outside an editor session
   * (SSR-only, no live bridge), or when the token is not present in
   * the cascade. Editors should render
   * `currentValue ?? defaultValue` for the "applied now" display and
   * keep `defaultValue` as the reset target.
   */
  currentValue?: string;
  /** Enum options when `type === 'select'`. */
  options?: ThemeTokenOption[];
  /**
   * Optional alias of another token (by `name`). Mainly for
   * semantic/primary tokens that default to a palette token — the
   * editor can hint "defaults to {aliasOf}" and offer a "link"
   * toggle.
   */
  aliasOf?: string;
  /**
   * Hidden from the editor UI by default. Set `true` for tokens that
   * are technically overridable but rarely should be (e.g. low-level
   * palette swatches when a semantic token exists).
   */
  advanced?: boolean;
}

/**
 * A logical grouping of tokens shown as a section / tab in the
 * ThemeEditor.
 */
export interface ThemeTokenGroup {
  /** Stable id (e.g. `brand-palette`). */
  id: string;
  /** Group label shown in the UI. */
  label: string;
  /** Optional one-line description explaining the group. */
  description?: string;
  tokens: ThemeToken[];
}

/**
 * Top-level manifest delivered to the editor via
 * `THEME_TOKENS_RESPONSE`.
 */
export interface ThemeTokenManifest {
  /** Site the manifest was resolved for; echoes the request param. */
  site: string;
  /**
   * The `.theme-<name>` class the storefront currently applies to
   * `<body>` for this site, if any. Editors can surface this to
   * confirm the override target.
   */
  baseTheme?: string;
  /**
   * When `true`, the manifest is a generic default (no site match);
   * the editor may warn that per-site styling isn't configured.
   */
  fallback?: boolean;
  groups: ThemeTokenGroup[];
}

/**
 * Service the storefront registers to expose its overridable tokens.
 * Keeping this behind DI means the extension ships the **format**
 * while each storefront ships the **data** — you can drop this plugin
 * into a new project and just register a different implementation.
 *
 * Implementations should be pure / deterministic; the SSR helper
 * (`fetchCMSThemeTokenManifest`) wraps callers in React's request-
 * scoped `cache()` so the manifest is built at most once per render.
 */
export interface CMSThemeTokenManifestService {
  /**
   * Resolve the manifest for a site. Returning a manifest with
   * `fallback: true` is the idiomatic way to indicate "no site-specific
   * list, here's the generic one". Returning `null` causes the
   * endpoint to respond with an empty manifest.
   */
  getManifest(site: string): Promise<ThemeTokenManifest | null>;
}
