import { forwardRef } from 'react';
import { createNavigation } from 'next-intl/navigation';
import type NextLink from 'next/link';
import { permanentRedirect as nextPermanentRedirect, redirect as nextRedirect } from 'next/navigation';
import type { SiteRoutingConfig } from '@/site/types';
import { addPrefixIfNeeded } from '@/site/utils';
import { SiteLink } from './SiteLink';

// helper taken from next-intl repo
type ParametersExceptFirst<Fn> = Fn extends (arg0: any, ...rest: infer R) => any ? R : never;

// intlRouting-Config depends on some non exposed types from next-intl so we pass any here
export function createSiteNavigationShared(siteRouting: SiteRoutingConfig, intlRouting: any, getSite: () => string) {
  const { Link: I18nLink, getPathname: getI18nPathname } = createNavigation(intlRouting);

  const config = siteRouting;

  function getPathname(
    args: Parameters<typeof getI18nPathname>[0] & { site?: string },
    ...rest: ParametersExceptFirst<typeof getI18nPathname>
  ): string {
    const availableSites = (process.env.NEXT_PUBLIC_AVAILABLE_SITES ?? '')
      .split(',')
      .map((configuredSite) => configuredSite.trim())
      .filter(Boolean);
    const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE?.trim() || availableSites[0];
    const site = args.site || defaultSite;
    const i18nArgs = args as Parameters<typeof getI18nPathname>[0];
    let i18nPathname = getI18nPathname(i18nArgs, ...rest);
    // Avoid trailing slashes
    if (i18nPathname.startsWith('//')) {
      i18nPathname = i18nPathname.slice(1);
    }
    const sitePathname = addPrefixIfNeeded(i18nPathname, site, siteRouting, args.forcePrefix);
    return sitePathname;
  }

  function getRedirectFn(fn: typeof nextRedirect | typeof nextPermanentRedirect) {
    return function redirectFn(
      args: Parameters<typeof getPathname>[0],
      ...rest: ParametersExceptFirst<typeof nextRedirect>
    ) {
      const redirectPathname = getPathname(args);
      return fn(redirectPathname, ...rest);
    };
  }

  const redirect = getRedirectFn(nextRedirect);
  const permanentRedirect = getRedirectFn(nextPermanentRedirect);

  interface LinkProps extends React.ComponentProps<typeof I18nLink> {
    site?: string;
  }

  const Link = forwardRef<any, LinkProps>(({ prefetch, ...props }, ref) => (
    <SiteLink
      {...props}
      prefetch={prefetch as React.ComponentProps<typeof NextLink>['prefetch']}
      ref={ref}
      I18nLink={I18nLink}
      getSite={getSite}
      siteRouting={siteRouting}
      getI18nPathname={getI18nPathname}
    />
  ));

  Link.displayName = 'Link';

  return {
    config,
    Link,
    redirect,
    permanentRedirect,
    getPathname,
  };
}
