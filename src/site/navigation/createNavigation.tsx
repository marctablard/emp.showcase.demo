'use client';
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { usePathname as useNextPathname, useRouter as useNextRouter } from 'next/navigation';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { createSiteNavigationShared } from '../shared/createNavigationShared';
import type { SiteRoutingConfig } from '../types';
import { addPrefixIfNeeded, getLocalePrefix, hasPathnamePrefixed, prependPrefix, unprefixPathname } from '../utils';

export default function createNavigation(siteRouting: SiteRoutingConfig, intlRouting: any) {
  const { Link, getPathname, redirect } = createSiteNavigationShared(siteRouting, intlRouting, useSiteCode);
  const { getPathname: getI18nPathname } = createIntlNavigation(intlRouting);

  // Prepends the SiteCode if necessary
  function usePathname(): string {
    const pathname = useNextPathname();
    const site = useSiteCode();
    const locale = useLocale();

    return useMemo(() => {
      if (!pathname) return pathname;

      let unprefixedPathname = pathname;
      let sitePrefix: string | null = null;
      if (site) {
        sitePrefix = prependPrefix(site);
        const isPathnameSitePrefixed = hasPathnamePrefixed(sitePrefix, pathname);

        if (isPathnameSitePrefixed) {
          unprefixedPathname = unprefixPathname(pathname, sitePrefix);
        }
      }
      // We must reimplement this logic, because next-intl does not allow to hook into it
      const localePrefix = getLocalePrefix(locale, intlRouting);
      const isPathnameLocalePrefixed = hasPathnamePrefixed(localePrefix, unprefixedPathname);
      if (isPathnameLocalePrefixed) {
        unprefixedPathname = unprefixPathname(unprefixedPathname, localePrefix);
      }

      // Guard against corrupted URLs that still contain the site prefix after stripping
      // (e.g. /brand1/de/brand1/product/123 → after first strip → /brand1/product/123)
      if (sitePrefix && hasPathnamePrefixed(sitePrefix, unprefixedPathname)) {
        unprefixedPathname = unprefixPathname(unprefixedPathname, sitePrefix);
      }

      return unprefixedPathname;
    }, [locale, site, pathname]);
  }

  function useRouter() {
    const nextRouter = useNextRouter();
    const currentLocale = useLocale();
    const site = useSiteCode();

    return useMemo(() => {
      type RouterOptions = Partial<Record<string, unknown>> & { locale?: string; site?: string };

      function getSiteOuterPath(href: string | { pathname: string }, options?: RouterOptions) {
        const { site: nextSite, locale: nextLocale } = options || {};
        const localeAwarePath =
          nextLocale !== undefined
            ? getI18nPathname({
                href: href as Parameters<typeof getI18nPathname>[0]['href'],
                locale: nextLocale,
                forcePrefix: true,
              })
            : typeof href === 'string'
              ? href
              : href.pathname;

        return addPrefixIfNeeded(localeAwarePath, nextSite || site, siteRouting);
      }

      function createHandler(fn: (href: string, options?: any) => void, method: 'push' | 'replace' | 'prefetch') {
        return function handler(href: string | { pathname: string }, options?: RouterOptions): void {
          const { site: _nextSite, locale: nextLocale, ...rest } = options || {};
          const path = getSiteOuterPath(href, options);

          if (method !== 'prefetch' && nextLocale && nextLocale !== currentLocale) {
            if (method === 'replace') {
              globalThis.location.replace(path);
              return;
            }

            globalThis.location.assign(path);
            return;
          }

          if (Object.keys(rest).length > 0) {
            fn(path, rest);
            return;
          }

          fn(path);
        };
      }

      return {
        ...nextRouter,
        push: createHandler(nextRouter.push, 'push'),
        replace: createHandler(nextRouter.replace, 'replace'),
        prefetch: createHandler(nextRouter.prefetch, 'prefetch'),
      };
    }, [currentLocale, nextRouter, site]);
  }

  return {
    Link,
    usePathname,
    useRouter,
    getPathname,
    redirect,
  };
}
