import { SitePrefixMode, SiteRoutingConfig } from './types';

const availableSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];
const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE || undefined;
if (defaultSite && (availableSites.length === 0 || !availableSites.includes(defaultSite))) {
  availableSites.push(defaultSite);
}

export default {
  default: {
    defaultSite: defaultSite,
    availableSites: availableSites,
    prefix: 'as-needed' as SitePrefixMode,
    cookie: { name: process.env.NEXT_PUBLIC_SITE_COOKIE || 'NEXT_SITE' },
    cookieOverridesDefault: true,
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
    cookie: { name: process.env.NEXT_PUBLIC_SITE_COOKIE || 'NEXT_SITE' },
    cookieOverridesDefault: true,
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
