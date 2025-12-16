import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { INTERNAL_SITE_HEADER, NEXT_REWRITE_HEADER, type SiteConfig, type SiteRoutingConfig } from '@/site/types';
import { setCachedRequestSite } from './server/RequestSiteCache';
import { resolveApplicableRouting, shouldPrefix } from './utils';

export function resolveSite(
  pathname: string,
  cookies: NextRequest['cookies'],
  headers: NextRequest['headers'],
  routing: SiteConfig,
): { site: string; appPath: string } {
  const segments = pathname.replace('/', '').split('/');
  let site: string | undefined;
  // first, try to resolve the site from the first path-segment
  if (routing.availableSites.includes(segments[0])) {
    site = segments.shift();
  }
  // second, try to look for an existing site-cookie
  if (!site && routing.cookie) {
    site = cookies.get(routing.cookie)?.value;
  }
  // third, try to look for an existing site-header
  if (!site && routing.header) {
    site = headers.get(routing.header) ?? undefined;
  }
  // fourth, use the default site
  if (!site) {
    site = routing.defaultSite;
  }
  return { site, appPath: segments.join('/') };
}
const NEXT_MIDDLEWARE_PREFIX = 'x-middleware-request-';
const INTL_LOCALE_HEADER = 'x-next-intl-locale';
const INTL_MIDDLEWARE_HEADER = NEXT_MIDDLEWARE_PREFIX + INTL_LOCALE_HEADER;

const intlMiddleware = createIntlMiddleware(routing);

const withCookies = function (from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
};

export function createSiteMiddleware(routingConfig: SiteRoutingConfig) {
  return (req: NextRequest) => {
    // First look for the matching routing by Domain
    const routing = resolveApplicableRouting(req.nextUrl.hostname, routingConfig);
    const { site, appPath } = resolveSite(req.nextUrl.pathname, req.cookies, req.headers, routing);
    setCachedRequestSite(site);

    const originalPathname = req.nextUrl.pathname;
    // fake a reduced path for the intlMiddleware
    req.nextUrl.pathname = appPath;
    // First we check if Next-Intl requires a redirect or rewrite
    const intlResponse = intlMiddleware(req);
    // and restore the URL!
    req.nextUrl.pathname = originalPathname;
    // if intl requires a redirect, let's
    const intlLocation = intlResponse.headers.get('location');
    if (intlLocation) {
      // build URL from redirectLocation
      const newLocation = new URL(intlLocation);
      // prepend site if necessary
      if (shouldPrefix(site, routingConfig)) {
        newLocation.pathname = `/${site}${newLocation.pathname == '/' ? '' : newLocation.pathname}`;
      }
      intlResponse.headers.set('location', newLocation.toString());
      return intlResponse;
    }
    // We can continue, but now we need to set the headers for Locale and Site
    const locale = intlResponse.headers.get(INTL_MIDDLEWARE_HEADER);
    const headers = new Headers(req.headers);
    if (locale) {
      headers.set(INTL_LOCALE_HEADER, locale);
    }
    if (site) {
      headers.set(INTERNAL_SITE_HEADER, site);
    }
    const intlRewrite = intlResponse.headers.get(NEXT_REWRITE_HEADER);
    if (intlRewrite) {
      // next-intl responded with rewrite, so we have to prepend our site
      const newRewrite = new URL(intlRewrite);
      newRewrite.pathname = `/${site}${newRewrite.pathname == '/' ? '' : newRewrite.pathname}`;
      return withCookies(intlResponse, NextResponse.rewrite(newRewrite, { request: { headers } }));
    }

    // Last but not least, we might need a rewrite or redirect
    if (shouldPrefix(site, routingConfig)) {
      if (req.nextUrl.pathname.startsWith(`/${site}`)) {
        return withCookies(intlResponse, NextResponse.next({ request: { headers } }));
      } else {
        const redirect = new URL(req.nextUrl);
        redirect.pathname = `/${site}${redirect.pathname == '/' ? '' : redirect.pathname}`;
        return withCookies(intlResponse, NextResponse.redirect(redirect));
      }
    } else {
      // no routing desired or it's the defaultSite and not needed
      // since it's either not desired or not needed
      // we need to redirect if site is part of the actual path,
      if (req.nextUrl.pathname.startsWith(`/${site}`)) {
        const redirect = new URL(req.nextUrl);
        redirect.pathname = appPath;
        return withCookies(intlResponse, NextResponse.redirect(redirect));
      } else {
        const rewrite = new URL(req.nextUrl);
        rewrite.pathname = `/${site}${rewrite.pathname == '/' ? '' : rewrite.pathname}`;
        return withCookies(intlResponse, NextResponse.rewrite(rewrite, { request: { headers } }));
      }
    }
  };
}
