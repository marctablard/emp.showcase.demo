import { SiteConfig, SiteRoutingConfig } from '@/site/types';

export function shouldPrefix(newSite: string | undefined, routing: SiteRoutingConfig) {
  if (routing.prefix === 'never') {
    return false;
  }
  if (routing.prefix === 'as-needed') {
    return newSite !== routing.defaultSite;
  }
  // prefix 'always'
  return true;
}

export function addPrefixIfNeeded(
  path: string,
  site: string | undefined = undefined,
  siteRouting: SiteRoutingConfig,
  forcePrefix: boolean = false,
) {
  if (site && (shouldPrefix(site, siteRouting) || forcePrefix)) {
    if (path.startsWith('/')) {
      return `/${site}${path}`;
    }
    return `/${site}/${path}`;
  }
  return path;
}

export function resolveApplicableRouting(hostname: string, routing: SiteRoutingConfig): SiteConfig {
  if (!routing.domains) {
    return routing;
  }
  const domainRouting = routing.domains.find((domain) =>
    domain.domain instanceof RegExp ? domain.domain.test(hostname) : domain.domain === hostname,
  );
  return domainRouting
    ? {
        ...domainRouting,
        cookie: routing.cookie,
        header: routing.header,
        cookieOverridesDefault: routing.cookieOverridesDefault,
      }
    : routing;
}

export function unprefixPathname(pathname: string, prefix: string) {
  return pathname.replace(new RegExp(`^${prefix}`), '') || '/';
}

export function hasPathnamePrefixed(prefix: string | undefined, pathname: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function prependPrefix(locale: string) {
  return '/' + locale;
}

export function getLocalePrefix<AppLocales extends string, AppLocalePrefixMode extends string>(
  locale: AppLocales[number],
  localePrefix: { mode: AppLocalePrefixMode; prefixes?: any },
) {
  return (
    (localePrefix.mode !== 'never' && localePrefix.prefixes?.[locale]) ||
    // We return a prefix even if `mode: 'never'`. It's up to the consumer
    // to decide to use it or not.
    prependPrefix(locale)
  );
}
