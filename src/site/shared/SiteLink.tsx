'use client';

import { forwardRef } from 'react';
import { SiteRoutingConfig } from '@/site/types';
import { addPrefixIfNeeded } from '@/site/utils';

interface SiteLinkProps extends React.ComponentPropsWithoutRef<any> {
  site?: string;
  I18nLink: React.ElementType;
  getSite: () => string;
  siteRouting: SiteRoutingConfig;
}

export const SiteLink = forwardRef<any, SiteLinkProps>(({ site, I18nLink, getSite, siteRouting, ...props }, ref) => {
  const originalHref = (props as React.ComponentProps<typeof I18nLink>).href;
  const prefixSite = site ?? getSite();
  const modifiedHref = addPrefixIfNeeded(
    typeof originalHref === 'string' ? originalHref : originalHref?.pathname || '',
    prefixSite,
    siteRouting,
  );

  return <I18nLink {...props} href={modifiedHref} ref={ref} />;
});

SiteLink.displayName = 'SiteLink';
