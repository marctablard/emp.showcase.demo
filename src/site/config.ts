import { SitePrefixMode, SiteRoutingConfig } from './types';

const availableSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];
const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
if (availableSites.length === 0 || availableSites.findIndex((c) => c === defaultSite) === -1) {
  availableSites.push(defaultSite);
}

export default {
  default: {
    defaultSite: defaultSite,
    availableSites: availableSites,
    prefix: 'as-needed' as SitePrefixMode,
    domains: [
      {
        domain: 'showcase.emporix.la',
        defaultSite: defaultSite,
        availableSites: availableSites,
        prefix: 'as-needed' as SitePrefixMode,
      },
    ],
  },
  local: {
    defaultSite: defaultSite,
    availableSites: availableSites,
    prefix: 'as-needed' as SitePrefixMode,
    domains: [
      {
        domain: 'localhost',
        defaultSite: defaultSite,
        availableSites: availableSites,
        prefix: 'as-needed' as SitePrefixMode,
      },
    ],
  },
} as { [key: string]: SiteRoutingConfig };
