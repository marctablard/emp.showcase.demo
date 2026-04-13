'use client';

import { forwardRef } from 'react';
import { useLocale } from 'next-intl';
import NextLink from 'next/link';
import type { UrlObject } from 'url';
import type { SiteRoutingConfig } from '@/site/types';
import { addPrefixIfNeeded } from '@/site/utils';

type NextLinkProps = React.ComponentPropsWithoutRef<typeof NextLink>;

interface SiteLinkOwnProps {
  href: string | UrlObject;
  site?: string;
  I18nLink: React.ElementType;
  getSite: () => string;
  siteRouting: SiteRoutingConfig;
  getI18nPathname: (args: { href: string; locale: string }) => string;
}

type SiteLinkProps = SiteLinkOwnProps & Omit<NextLinkProps, keyof SiteLinkOwnProps>;

export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(
  ({ site, I18nLink: _I18nLink, getSite, siteRouting, getI18nPathname, ...props }, ref) => {
    const locale = useLocale();
    const prefixSite = site ?? getSite();
    const originalHref = props.href;
    const hrefString = typeof originalHref === 'string' ? originalHref : ((originalHref as UrlObject)?.pathname ?? '');

    const i18nPath = getI18nPathname({ href: hrefString, locale });
    const finalHref = addPrefixIfNeeded(i18nPath, prefixSite, siteRouting);

    return <NextLink {...props} href={finalHref} ref={ref} />;
  },
);

SiteLink.displayName = 'SiteLink';
