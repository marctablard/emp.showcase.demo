import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCssDeclaration, resolveTargetSelector } from '../lib/build-theme-css';
import { fetchCMSTheme } from '../lib/fetch-cms-theme';

/**
 * GET handler for the per-site CMS theme stylesheet.
 *
 * Designed to be re-exported from `app/[site]/cms-theme.css/route.ts`
 * as a one-liner:
 *
 * ```ts
 * export { cmsThemeCssGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
 * ```
 *
 * Serves the persisted (live) theme variables as a real CSS resource
 * so the browser can preflight and cache it like any other stylesheet,
 * and the storefront `<link rel="stylesheet">` benefits from React 19
 * resource hoisting + CDN edge caching.
 *
 * Wire-format:
 *  - URL: `/<site>/cms-theme.css?v=<version>`
 *  - `site` is a path segment so per-site responses cache without a
 *    `Vary` header.
 *  - `v` is a cache-busting nonce \u2014 when present the response is
 *    served with a far-future immutable Cache-Control because a
 *    publish bump changes the URL. When absent the route falls back
 *    to the upstream theme TTL so a stale URL is still correct, just
 *    slightly less efficient at the edge.
 *
 * Theme resolution goes through the same `fetchCMSTheme` helper used
 * by the SSR `<link>` emitter, so the linked resource is guaranteed to
 * agree on selector + variables with what the storefront expected at
 * render time.
 *
 * `themeClass` / `baseTheme` are intentionally not exposed as query
 * params \u2014 the persisted theme row already carries `baseTheme`, which
 * `resolveTargetSelector` consumes server-side. Keeping it server-
 * resolved prevents an attacker from crafting a URL that targets an
 * arbitrary selector.
 */
export async function cmsThemeCssGET(
  request: NextRequest,
  { params }: { params: Promise<{ site: string }> },
): Promise<NextResponse> {
  const { site } = await params;
  if (!site) {
    return new NextResponse('Missing site', { status: 400 });
  }

  const versionParam = request.nextUrl.searchParams.get('v');
  // `?v=live-preview` / `?v=draft` are the editor's cache-bypass
  // tokens. Anything else is treated as a stable content-hash buster.
  const isLivePreview = versionParam === 'live-preview';
  const isDraft = versionParam === 'draft';
  const isPreviewMode = isLivePreview || isDraft;

  const theme = await fetchCMSTheme(site, isDraft ? 'draft' : isLivePreview ? 'live-preview' : undefined);
  const variables = theme?.variables ?? {};
  // `baseTheme` from the persisted row drives the selector. When a row
  // exists but has no `baseTheme`, fall through to the
  // `body[data-cms-site=...]` attribute selector \u2014 same precedence as
  // the SSR `<link>` emitter.
  const target = resolveTargetSelector(theme?.baseTheme, site);
  const css = buildCssDeclaration(target, variables);

  // Editor previews must not cache; content-hashed URLs are safe to
  // pin; bare URLs fall back to a short s-maxage + SWR for the edge.
  const cacheControl = isPreviewMode
    ? 'private, no-store'
    : versionParam
      ? 'public, max-age=360, immutable'
      : 'public, max-age=0, s-maxage=10, stale-while-revalidate=60';

  return new NextResponse(css, {
    status: 200,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}
