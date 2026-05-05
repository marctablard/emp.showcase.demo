/**
 * Single source of truth for the CMS theme stylesheet identifiers
 * shared between the SSR `<link>` emitter
 * (`emporix-cms-theme-style.tsx`), the route handler that serves the
 * persisted theme (`app/[site]/cms-theme.css/route.ts`), and the live
 * editor bridge that owns the in-iframe draft `<style>`
 * (`useCMSThemeLiveEditor.ts`).
 *
 * Two distinct DOM elements participate in the theming cascade:
 *   1. A React-managed `<link rel="stylesheet" precedence>` carrying
 *      the persisted theme as a real CSS resource. Identified by
 *      {@link THEME_STYLE_HREF_ATTR} (= React 19's `data-href`),
 *      keyed by {@link themeStyleHref}.
 *   2. A bridge-owned `<style>` carrying the editor's draft delta.
 *      Created on demand only inside the editor iframe; identified by
 *      {@link THEME_DRAFT_MARKER_ATTR} so the bridge's straggler sweep
 *      can find its own nodes without colliding with React's `<link>`.
 */

/**
 * Logical name of the canonical stylesheet. Used as the prefix for
 * the React 19 `<link>` dedup key {@link themeStyleHref} and as the
 * stable identifier referenced in the editor integration spec. Not a
 * DOM `id` — React 19 strips custom attributes when it hoists a
 * resource element, surfacing only `data-href` and `data-precedence`
 * on the live node.
 */
export const THEME_STYLE_NODE_ID = 'cms-theme-override';

/**
 * Attribute React 19 stamps on hoisted resource elements, derived
 * from the `href` prop. Used by the bridge to locate the persisted
 * `<link>` for diagnostic / cascade-position purposes (the bridge
 * never mutates the link itself).
 */
export const THEME_STYLE_HREF_ATTR = 'data-href';

/**
 * Marker attribute stamped on the bridge-owned draft `<style>`.
 *
 * The value is the site code, mirroring the persisted `<link>`'s
 * `data-href` site key — keeps cross-tab debugging trivial when the
 * editor harness ever previews multiple sites at once.
 *
 * Stays distinct from {@link THEME_STYLE_HREF_ATTR} so the sweep can
 * unambiguously target draft elements without risking the deletion
 * of React's hoisted `<link>`.
 */
export const THEME_DRAFT_MARKER_ATTR = 'data-cms-theme-draft';

/**
 * React 19 `precedence` group for the override `<style>`.
 *
 * Setting this prop opts the element into React 19's stylesheet
 * resource-hoisting machinery: the runtime relocates the node into
 * `<head>` regardless of where in the tree it was rendered, dedupes
 * across renders by {@link THEME_STYLE_NODE_ID}-equivalent `href` keys
 * (so a re-rendering server component updates **the same** node
 * instead of producing a sibling), and orders precedence groups
 * deterministically.
 *
 * Chosen to sort lexicographically **after** the storefront's app and
 * Tailwind layers (which use either no `precedence` or a `default`
 * group) so the override declarations win the cascade against the
 * base theme without resorting to `!important`.
 */
export const THEME_STYLE_PRECEDENCE = 'cms-theme';

/**
 * Compute the React 19 dedup key for a given site. React 19 dedupes
 * `<style precedence>` elements by `href` within a precedence group,
 * so each site in the same document gets its own canonical node — in
 * practice a tab is scoped to one site, but per-site keys keep the
 * contract robust if that ever changes (e.g. a multi-site preview
 * harness in the editor).
 */
export function themeStyleHref(site: string): string {
  return `${THEME_STYLE_NODE_ID}-${site}`;
}
