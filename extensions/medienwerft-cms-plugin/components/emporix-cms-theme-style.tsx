import { cmsThemeCssUrl, resolveTargetSelector } from '../lib/build-theme-css';
import { fetchCMSTheme } from '../lib/fetch-cms-theme';
import { fetchCMSThemeTokenManifest } from '../lib/fetch-cms-theme-token-manifest';
import { THEME_STYLE_PRECEDENCE, themeStyleHref } from '../lib/theme-style-constants';
import EmporixCmsThemeLiveBridge from './emporix-cms-theme-live-bridge';

export type EmporixCmsThemeStyleProps = {
  /**
   * Site code the overrides apply to. Required — the theme is stored
   * per-site.
   */
  site: string;
  /**
   * The CSS class applied to the document body for the active base
   * theme (e.g. `theme-medienwerft`). When provided, overrides target
   * `.theme-medienwerft`; otherwise they target `:root` with a
   * `data-cms-site` attribute selector.
   */
  themeClass?: string;
};

/**
 * Renders the per-site CMS theme variable overrides as a real CSS
 * resource, plus the live-editor bridge the editor iframe uses to
 * preview drafts.
 *
 * Architecture:
 *  - **Persisted theme**: a `<link rel="stylesheet" precedence>` whose
 *    URL points at the `app/[site]/cms-theme.css` route handler. The
 *    handler resolves the same `fetchCMSTheme(site)` data this
 *    component reads, so SSR and the linked resource are guaranteed
 *    to agree on selector + variables. Browsers cache the response
 *    like any other stylesheet, with a far-future `immutable`
 *    Cache-Control when the URL carries the version-busting `?v=`.
 *  - **Editor drafts**: handled entirely client-side by the live
 *    bridge, which appends its own `<style>` after the `<link>` only
 *    inside the editor iframe. The `<link>` is never mutated.
 *
 * **Editor mode** is detected client-side by the bridge (layouts in
 * the App Router do not receive `searchParams`). The bridge mounts
 * unconditionally; when it determines the page is inside the editor
 * iframe (`window.parent !== window` + `?editMode=true`) it starts
 * listening for `UPDATE_THEME_VARIABLES` etc.
 */
export default async function EmporixCmsThemeStyle({ site, themeClass }: EmporixCmsThemeStyleProps) {
  if (!site) return null;

  // SSR resolves the published theme so we can emit a versioned
  // `<link>` and hand the bridge the published baseline it needs to
  // seed `THEME_RESPONSE` without an extra fetch. Both reads are
  // request-scoped via React's `cache()`. The bridge swaps the URL to
  // a cache-bypassed `?v=` in editor mode (no host opt-in needed).
  const [theme, manifest] = await Promise.all([fetchCMSTheme(site), fetchCMSThemeTokenManifest(site)]);
  const variables = theme?.variables ?? {};
  const target = resolveTargetSelector(themeClass ?? theme?.baseTheme, site);
  const version = theme?.version ?? 'live';

  return (
    <>
      {/*
        React 19 stylesheet resource hoisting:
          - `href` + `precedence` opt this element into React's resource
            hoisting machinery. The runtime relocates the node into
            <head> from wherever in the tree it was rendered, and
            dedupes across renders so a re-running async server
            component updates the same node.
          - The CSS body is served by the `cms-theme.css` route handler
            under `app/[site]/`, keyed by `?v=<version>` so a publish
            bump invalidates downstream caches with no server-side
            cache busting.
          - React 19 strips other attributes from hoisted resource
            elements (incl. `id`) — the bridge locates the live node
            via `data-href`, which React derives from this `href`
            prop. See `theme-style-constants.ts`.
      */}
      <link
        rel="stylesheet"
        href={cmsThemeCssUrl(site, version)}
        precedence={THEME_STYLE_PRECEDENCE}
        // Stamp the logical (version-stable) dedup key as a self-
        // documenting data attribute. React 19 still keys its own
        // resource cache off the full `href` (incl. `?v=`), but
        // surfacing the stable id here keeps debugging trivial.
        data-cms-theme-href={themeStyleHref(site)}
      />
      <EmporixCmsThemeLiveBridge
        site={site}
        baseTheme={theme?.baseTheme ?? themeClass}
        target={target}
        version={version}
        publishedVariables={variables}
        manifest={manifest}
      />
    </>
  );
}
