/**
 * Pure helpers for the CMS Theme entity.
 *
 * This file must **not** import `@/platform/ssr` — the Theme service
 * and the Theme API both pull from here, and they are themselves part
 * of the `ssr` container module graph. A top-level `import ssr` here
 * creates a circular import that Turbopack's module runtime resolves
 * to a TDZ at the default export.
 */

/**
 * Build the Emporix entity id for a theme row.
 *
 * Unlike pages/layouts, themes do not carry a locale suffix — one row
 * per site — so the id convention is simpler:
 *
 *  - `cms-theme-<site>` (live)
 *  - `cms-theme-<site>-draft`
 *  - `cms-theme-<site>-<archivedTimestamp>`
 *
 * Lower-cased to keep the id deterministic regardless of casing in the
 * site param.
 */
export function buildThemeEntityId(site: string, version?: 'draft' | 'live' | string): string {
  const base = `cms-theme-${site.toLowerCase()}`;
  if (!version || version === 'live') return base;
  if (version === 'draft') return `${base}-draft`;
  return `${base}-${version}`;
}
