/**
 * Pure helpers shared between the SSR `<link>` emitter
 * (`emporix-cms-theme-style.tsx`) and the route handler that serves the
 * persisted theme as a CSS resource (`app/[site]/cms-theme.css/route.ts`).
 *
 * Pulled out of the SSR component so the route handler can produce the
 * exact same selector and the exact same sanitization without
 * importing a server React component.
 *
 * Framework-free (no React, no Next imports) so the route handler stays
 * trivial to test in isolation.
 */

/**
 * Build the CSS selector the overrides apply to. Preference order:
 *  1. `themeClass` prop (e.g. `theme-medienwerft`) — handles the site's
 *     existing base theme class.
 *  2. A `body[data-cms-site="<site>"]` attribute selector — requires
 *     the storefront to stamp `data-cms-site` on the body element (the
 *     root layout sets this automatically).
 *
 * The class name is sanitized — only ASCII word chars + `-` are
 * allowed — preventing CSS injection via a malicious `baseTheme`
 * attribute on the persisted theme row.
 */
export function resolveTargetSelector(themeClass: string | undefined, site: string): string {
  const normalized = (themeClass ?? '').trim();
  if (normalized && /^[a-zA-Z0-9_-]+$/.test(normalized)) {
    return `.${normalized}`;
  }
  const safeSite = site.replace(/[^a-zA-Z0-9_-]/g, '');
  return `body[data-cms-site="${safeSite}"]`;
}

/**
 * Serialize the variable map into a single CSS declaration block.
 * Values are sanitized by the service, but we strip `<`/`>`/`;` one
 * more time at the edge to keep the rendered CSS text safe — same
 * defense-in-depth posture as the inline-`<style>` emitter had.
 *
 * An empty variable set produces `target { }` (one rule, no
 * declarations). The route handler relies on this to keep the
 * `<link>` resource non-empty even when no theme row exists, so the
 * stylesheet still loads and contributes nothing instead of 404-ing.
 */
export function buildCssDeclaration(target: string, variables: Record<string, string>): string {
  const entries = Object.entries(variables);
  if (entries.length === 0) {
    return `${target} { }`;
  }
  const decls = entries.map(([name, value]) => `${sanitizeToken(name)}: ${sanitizeValue(value)};`).join(' ');
  return `${target} { ${decls} }`;
}

export function sanitizeToken(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function sanitizeValue(value: string): string {
  return value.replace(/[<>;]/g, '').trim();
}

/**
 * URL the SSR `<link rel="stylesheet">` and the editor's preflight
 * point at. Site is a path segment (not a query param) because the
 * route lives at `app/[site]/cms-theme.css/route.ts`; encoding it as
 * a path component keeps it readable in the network panel and lets
 * CDNs cache per-site without a Vary header.
 *
 * `version` is appended as `?v=<value>` so a publish bump invalidates
 * downstream caches without server-side cache busting. When omitted,
 * the route handler falls back to its short-TTL Cache-Control.
 *
 * Both segments are URI-encoded — site codes are constrained to
 * `[a-zA-Z0-9_-]` upstream but encoding here keeps the function safe
 * against any future relaxation of that constraint.
 */
export function cmsThemeCssUrl(site: string, version?: string | number | null): string {
  const path = `/${encodeURIComponent(site)}/cms-theme.css`;
  if (version === undefined || version === null || version === '') return path;
  return `${path}?v=${encodeURIComponent(String(version))}`;
}
