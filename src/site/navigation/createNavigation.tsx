'use client';
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { usePathname as useNextPathname, useRouter as useNextRouter } from 'next/navigation';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { createSiteNavigationShared } from '../shared/createNavigationShared';
import { SiteRoutingConfig } from '../types';
import { addPrefixIfNeeded, getLocalePrefix, hasPathnamePrefixed, prependPrefix, unprefixPathname } from '../utils';

export default function createNavigation(siteRouting: SiteRoutingConfig, intlRouting: any) {
  const { Link, getPathname, redirect } = createSiteNavigationShared(siteRouting, intlRouting, useSiteCode);

  // Prepends the SiteCode if necessary
  function usePathname(): string {
    const pathname = useNextPathname();
    const site = useSiteCode();
    const locale = useLocale();

    return useMemo(() => {
      if (!pathname) return pathname;

      let unprefixedPathname = pathname;
      const sitePrefix = prependPrefix(site);
      const isPathnameSitePrefixed = hasPathnamePrefixed(sitePrefix, pathname);

      if (isPathnameSitePrefixed) {
        unprefixedPathname = unprefixPathname(pathname, sitePrefix);
      }
      // We must reimplement this logic, because next-intl does not allow to hook into it
      const localePrefix = getLocalePrefix(locale, intlRouting);
      const isPathnameLocalePrefixed = hasPathnamePrefixed(localePrefix, unprefixedPathname);
      if (isPathnameLocalePrefixed) {
        unprefixedPathname = unprefixPathname(unprefixedPathname, localePrefix);
      }
      return unprefixedPathname;
    }, [locale, site, pathname]);
  }

  function useRouter() {
    const nextRouter = useNextRouter();
    const site = useSiteCode();
    return useMemo(() => {
      function createHandler<Options, Fn extends (href: string, options?: Options) => void>(fn: Fn) {
        return function handler(
          href: string | { pathname: string },
          options?: Partial<Options> & { site?: string },
        ): void {
          const { site: nextSite, ...rest } = options || {};
          const path = addPrefixIfNeeded(
            typeof href === 'string' ? href : href.pathname,
            nextSite || (site as string),
            siteRouting,
          );
          const args: [href: string, options?: Options] = [path];
          if (Object.keys(rest).length > 0) {
            // @ts-expect-error unsafe typing expected
            args.push(rest);
          }
          fn(...args);
        };
      }

      return {
        ...nextRouter,
        push: createHandler<Parameters<typeof nextRouter.push>[1], typeof nextRouter.push>(nextRouter.push),
        replace: createHandler<Parameters<typeof nextRouter.replace>[1], typeof nextRouter.replace>(nextRouter.replace),
        prefetch: createHandler<Parameters<typeof nextRouter.prefetch>[1], typeof nextRouter.prefetch>(
          nextRouter.prefetch,
        ),
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
