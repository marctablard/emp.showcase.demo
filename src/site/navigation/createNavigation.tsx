'use client';
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { usePathname as useNextPathname } from 'next/navigation';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { createSiteNavigationShared } from '../shared/createNavigationShared';
import type { SiteRoutingConfig } from '../types';
import { addPrefixIfNeeded, getLocalePrefix, hasPathnamePrefixed, prependPrefix, unprefixPathname } from '../utils';

export default function createNavigation(siteRouting: SiteRoutingConfig, intlRouting: any) {
  const { Link, getPathname, redirect } = createSiteNavigationShared(siteRouting, intlRouting, useSiteCode);
  const { useRouter: useIntlRouter } = createIntlNavigation(intlRouting);

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
    const nextRouter = useIntlRouter();
    const site = useSiteCode();
    return useMemo(() => {
      function createHandler(fn: (href: string, options?: any) => void) {
        return function handler(
          href: string | { pathname: string },
          options?: Partial<Record<string, unknown>> & { site?: string },
        ): void {
          const { site: nextSite, ...rest } = options || {};
          const path = addPrefixIfNeeded(
            typeof href === 'string' ? href : href.pathname,
            nextSite || site,
            siteRouting,
          );
          if (Object.keys(rest).length > 0) {
            fn(path, rest);
            return;
          }
          fn(path);
        };
      }

      return {
        ...nextRouter,
        push: createHandler(nextRouter.push),
        replace: createHandler(nextRouter.replace),
        prefetch: createHandler(nextRouter.prefetch),
      };
    }, [nextRouter, site]);
  }

  return {
    Link,
    usePathname,
    useRouter,
    getPathname,
    redirect,
  };
}
