import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing as intlRouting } from '@/i18n/routing';
import { getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import { edgeLog } from '@/lib/server/edge-stderr-log';
import { PREVIEW_ROUTE_PREFIX, getPreviewDetector } from '@/platform/services/cms/preview/preview-detector-registry';
import {
  INTERNAL_APP_PATH_HEADER,
  INTERNAL_SITE_HEADER,
  INTERNAL_SITE_INVALID_HEADER,
  NEXT_REWRITE_HEADER,
  type SiteConfig,
  type SiteRoutingConfig,
} from '@/site/types';
import { isLikelyProbe } from './probe-detection';
import { setCachedRequestSite } from './server/RequestSiteCache';
import { resolveApplicableRouting, shouldPrefix } from './utils';

const intlMiddleware = createIntlMiddleware(intlRouting);

/**
 * True when the pathname is the default-site URL shape for `prefix: 'as-needed'`: no explicit
 * `/{site}/` segment for a non-default site (locale-first like `/en/...`, default-locale-hidden
 * like `/browse`, or `/`). Those URLs must not be reinterpreted from the site cookie, or a stale
 * cookie overrides the visible URL (broken site switcher / session alignment).
 */
function isUnprefixedDefaultSiteCanonicalPath(
  pathname: string,
  siteRouting: SiteConfig,
  localeCodes: readonly string[],
): boolean {
  const trimmed = pathname.replace(/^\//, '');
  if (!trimmed) {
    return true;
  }
  const first = trimmed.split('/')[0];
  if (localeCodes.includes(first)) {
    return true;
  }
  return !siteRouting.availableSites.includes(first);
}

function syncSiteCookie(
  req: NextRequest,
  res: NextResponse,
  routing: SiteConfig,
  resolvedSite?: string,
  resolvedLocale?: string,
) {
  if (!routing.cookie) {
    return;
  }

  if (resolvedSite) {
    const site = req.cookies?.get(routing.cookie.name);
    if (site?.value !== resolvedSite) {
      const maxAge = routing.cookie.maxAge ?? 365 * 24 * 60 * 60;
      res.cookies.set({
        name: routing.cookie.name,
        value: resolvedSite,
        maxAge: maxAge,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  if (resolvedLocale) {
    const localeCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE;
    if (localeCookieName) {
      const locale = req.cookies?.get(localeCookieName);
      if (locale?.value !== resolvedLocale) {
        const maxAge = routing.cookie.maxAge ?? 365 * 24 * 60 * 60;
        res.cookies.set({
          name: localeCookieName,
          value: resolvedLocale,
          maxAge: maxAge,
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
        });
      }
    }
  }
}

export function resolveSite(
  pathname: string,
  cookies: NextRequest['cookies'],
  headers: NextRequest['headers'],
  routing: SiteConfig,
): { site: string | undefined; appPath: string } {
  const segments = pathname.replace('/', '').split('/');
  let site: string | undefined;
  // first, try to resolve the site from the first path-segment
  if (routing.availableSites.includes(segments[0])) {
    site = segments.shift();
  }
  // second, for as-needed + default site: unprefixed canonical paths are authoritative for site identity
  // (cookie/header must not pull another tenant onto `/en/...`, `/browse`, `/`, etc.).
  if (!site && routing.defaultSite && routing.prefix === 'as-needed') {
    if (isUnprefixedDefaultSiteCanonicalPath(pathname, routing, intlRouting.locales ?? [])) {
      site = routing.defaultSite;
    }
  }
  // third, try to look for an existing site-cookie
  if (!site && routing.cookie && routing.cookieOverridesDefault) {
    site = cookies.get(routing.cookie.name)?.value;
  }
  // fourth, try to look for an existing site-header
  if (!site && routing.header) {
    site = headers.get(routing.header) ?? undefined;
  }
  // fifth, use the default site
  if (!site) {
    site = routing.defaultSite;
  }
  return { site, appPath: segments.join('/') };
}
const NEXT_MIDDLEWARE_PREFIX = 'x-middleware-request-';
const INTL_LOCALE_HEADER = 'x-next-intl-locale';
const INTL_MIDDLEWARE_HEADER = NEXT_MIDDLEWARE_PREFIX + INTL_LOCALE_HEADER;

function isProbeProtectedMainRoute(pathname: string, routing: SiteConfig): boolean {
  if (pathname === '/') {
    return true;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    return (intlRouting.locales ?? []).includes(segments[0]);
  }

  if (segments.length === 2) {
    return routing.availableSites.includes(segments[0]) && (intlRouting.locales ?? []).includes(segments[1]);
  }

  return false;
}

function handleMisroutedHealthCheck(req: NextRequest): NextResponse {
  const ua = req.headers.get('user-agent') ?? '';
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const rid = req.headers.get('x-request-id') ?? '';

  edgeLog('warn', 'misrouted_healthcheck', {
    path: req.nextUrl.pathname,
    method: req.method,
    ua,
    xff,
    rid,
    recommendation: 'Configure health checks to use /api/health or /api/ready',
  });

  return new NextResponse('OK', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-misrouted-healthcheck': '1',
      'x-recommended-endpoint': '/api/health',
      'x-alternative-endpoint': '/api/ready',
    },
  });
}

const withCookies = function (
  from: NextResponse,
  to: NextResponse,
  req: NextRequest,
  routing: SiteConfig,
  resolvedSite?: string,
  resolvedLocale?: string,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  syncSiteCookie(req, to, routing, resolvedSite, resolvedLocale);
  return to;
};

/**
 * Preview routes carry their own `/preview/[site]/[locale]/...` — they are
 * never site-rewritten. The edge-safe detector flags genuine preview requests
 * so caching is skipped; everything Storyblok-specific stays out of the Edge
 * bundle (the registry imports only the pure detection module).
 *
 * Returns `null` when the request is not a preview route, so the caller falls
 * through to normal site handling.
 */
function handlePreviewRoute(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  // Segment-exact: a bare `startsWith` would also swallow `/previewable`,
  // silently skipping the site rewrite for an unrelated app route.
  const isPreviewRoute = pathname === PREVIEW_ROUTE_PREFIX || pathname.startsWith(`${PREVIEW_ROUTE_PREFIX}/`);
  if (!isPreviewRoute) {
    return null;
  }
  const isPreview = getPreviewDetector(process.env).isPreviewRequest(req.nextUrl);
  const res = NextResponse.next();
  if (isPreview) {
    res.headers.set('cache-control', 'no-store');
  }
  return res;
}

/**
 * Resolves the site from path/cookie/header, then validates it against
 * `availableSites`. A site outside that list falls back to `defaultSite` when
 * one is configured; without a default it is flagged invalid so the layout can
 * render not-found. A request that resolves no site at all lands on the first
 * available site.
 */
function resolveValidatedSite(
  req: NextRequest,
  routing: SiteConfig,
): { site: string; appPath: string; siteInvalid: boolean } {
  const { site: resolvedSite, appPath } = resolveSite(req.nextUrl.pathname, req.cookies, req.headers, routing);
  let site = resolvedSite;
  let siteInvalid = false;

  if (site && !routing.availableSites.includes(site)) {
    if (routing.defaultSite) {
      site = routing.defaultSite;
    } else {
      edgeLog('warn', 'invalid_site_rejected', {
        site,
        path: req.nextUrl.pathname,
        availableSites: routing.availableSites,
        recommendation: 'Check NEXT_PUBLIC_AVAILABLE_SITES configuration',
      });
      siteInvalid = true;
      site = routing.availableSites[0];
    }
  }

  const effectiveSite = site === undefined || site === '' ? routing.availableSites[0] : site;
  return { site: effectiveSite, appPath, siteInvalid };
}

/** Request headers forwarded to the app: resolved app path, locale and site. */
function buildForwardHeaders(
  req: NextRequest,
  appPath: string,
  locale: string | null,
  site: string,
  siteInvalid: boolean,
): Headers {
  const headers = new Headers(req.headers);
  headers.set(INTERNAL_APP_PATH_HEADER, appPath);
  if (locale) {
    headers.set(INTL_LOCALE_HEADER, locale);
  }
  if (site) {
    headers.set(INTERNAL_SITE_HEADER, site);
  }
  if (siteInvalid) {
    headers.set(INTERNAL_SITE_INVALID_HEADER, 'true');
  }
  return headers;
}

/** Rewrites an invalid-site request onto a valid route so the layout can render not-found. */
function rewriteForInvalidSite(
  req: NextRequest,
  intlResponse: NextResponse,
  site: string,
  appPath: string,
  headers: Headers,
): NextResponse {
  const rewrite = new URL(req.nextUrl);
  const appSegment = appPath === '' || appPath === '/' ? '' : `/${appPath}`;
  rewrite.pathname = `/${site}${appSegment}`;
  const response = NextResponse.rewrite(rewrite, { request: { headers } });
  intlResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });
  return response;
}

/**
 * Aligns the URL with the site-prefix policy: prefixed sites gain their
 * `/{site}` segment, non-prefixed sites lose it. Returns `null` when the URL
 * already matches and no redirect is needed.
 */
function resolveSitePrefixRedirect(
  req: NextRequest,
  intlResponse: NextResponse,
  routing: SiteConfig,
  site: string,
  appPath: string,
  resolvedLocale: string,
  headers: Headers,
): NextResponse | null {
  const hasSitePrefix = req.nextUrl.pathname.startsWith(`/${site}`);

  if (shouldPrefix(site, routing)) {
    if (hasSitePrefix) {
      return null;
    }
    const redirect = new URL(req.nextUrl);
    redirect.pathname = `/${site}${redirect.pathname == '/' ? '' : redirect.pathname}`;
    return withCookies(intlResponse, NextResponse.redirect(redirect, { headers }), req, routing, site, resolvedLocale);
  }

  if (!hasSitePrefix) {
    return null;
  }
  const redirect = new URL(req.nextUrl);
  redirect.pathname = appPath ? `/${appPath}` : '/';
  return withCookies(intlResponse, NextResponse.redirect(redirect), req, routing, site, resolvedLocale);
}

/** Final hop: pass through when the path already carries the site, otherwise rewrite onto it. */
function buildSiteResponse(req: NextRequest, site: string, headers: Headers): NextResponse {
  if (req.nextUrl.pathname.startsWith(`/${site}`)) {
    return NextResponse.next({ request: { headers } });
  }
  const rewrite = new URL(req.nextUrl);
  rewrite.pathname = `/${site}${rewrite.pathname == '/' ? '' : rewrite.pathname}`;
  return NextResponse.rewrite(rewrite, { request: { headers } });
}

/**
 * Runs next-intl against the site-stripped path. The reduced path is faked in
 * and restored right after, so callers still see the original URL.
 */
function runIntlMiddleware(req: NextRequest, appPath: string): NextResponse {
  const originalPathname = req.nextUrl.pathname;
  req.nextUrl.pathname = appPath;
  const intlResponse = intlMiddleware(req);
  req.nextUrl.pathname = originalPathname;
  return intlResponse;
}

/**
 * next-intl asked for a locale redirect — re-issue it with the site segment
 * prepended where the routing policy requires one. Returns `null` when intl
 * wants no redirect.
 */
function resolveIntlRedirect(
  req: NextRequest,
  intlResponse: NextResponse,
  routing: SiteConfig,
  site: string,
): NextResponse | null {
  const intlLocation = intlResponse.headers.get('location');
  if (!intlLocation) {
    return null;
  }
  const newLocation = new URL(intlLocation);
  // prepend site if necessary
  if (shouldPrefix(site, routing)) {
    newLocation.pathname = `/${site}${newLocation.pathname == '/' ? '' : newLocation.pathname}`;
  }
  return withCookies(intlResponse, NextResponse.redirect(newLocation), req, routing, site);
}

/**
 * next-intl asked for a rewrite — prepend our site segment to its target.
 * Returns `null` when intl wants no rewrite.
 */
function resolveIntlRewrite(
  req: NextRequest,
  intlResponse: NextResponse,
  routing: SiteConfig,
  site: string,
  resolvedLocale: string,
  headers: Headers,
): NextResponse | null {
  const intlRewrite = intlResponse.headers.get(NEXT_REWRITE_HEADER);
  if (!intlRewrite) {
    return null;
  }
  const newRewrite = new URL(intlRewrite);
  newRewrite.pathname = `/${site}${newRewrite.pathname == '/' ? '' : newRewrite.pathname}`;
  return withCookies(
    intlResponse,
    NextResponse.rewrite(newRewrite, { request: { headers } }),
    req,
    routing,
    site,
    resolvedLocale,
  );
}

export function createSiteMiddleware(routingConfig: SiteRoutingConfig) {
  return (req: NextRequest) => {
    const path = req.nextUrl.pathname;
    const routing = resolveApplicableRouting(req.nextUrl.hostname, routingConfig);

    const previewResponse = handlePreviewRoute(req);
    if (previewResponse) {
      return previewResponse;
    }

    // Only protect actual entry routes; arbitrary two-segment paths such as /json/list
    // are not app pages and should not be treated as misrouted probes.
    if (isProbeProtectedMainRoute(path, routing) && isLikelyProbe(req)) {
      return handleMisroutedHealthCheck(req);
    }

    const { site, appPath, siteInvalid } = resolveValidatedSite(req, routing);

    if (!siteInvalid) {
      setCachedRequestSite(site);
    }

    // First we check if Next-Intl requires a redirect or rewrite
    const intlResponse = runIntlMiddleware(req, appPath);

    if (!siteInvalid) {
      const intlRedirect = resolveIntlRedirect(req, intlResponse, routing, site);
      if (intlRedirect) {
        return intlRedirect;
      }
    }

    // We can continue, but now we need to set the headers for Locale and Site
    const locale = intlResponse.headers.get(INTL_MIDDLEWARE_HEADER);
    const resolvedLocale = locale || getPublicDefaultLanguage();
    const headers = buildForwardHeaders(req, appPath, locale, site, siteInvalid);

    if (siteInvalid) {
      return rewriteForInvalidSite(req, intlResponse, site, appPath, headers);
    }

    const prefixRedirect = resolveSitePrefixRedirect(
      req,
      intlResponse,
      routing,
      site,
      appPath,
      resolvedLocale,
      headers,
    );
    if (prefixRedirect) {
      return prefixRedirect;
    }

    const intlRewrite = resolveIntlRewrite(req, intlResponse, routing, site, resolvedLocale, headers);
    if (intlRewrite) {
      return intlRewrite;
    }

    return withCookies(intlResponse, buildSiteResponse(req, site, headers), req, routing, site, resolvedLocale);
  };
}
