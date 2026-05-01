import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import type { SitePrefixMode, SiteRoutingConfig } from './types';

const availableSites = (process.env.NEXT_PUBLIC_AVAILABLE_SITES ?? '')
  .split(',')
  .map((site) => site.trim())
  .filter(Boolean);
const configuredDefaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE?.trim() || undefined;
const defaultSite = configuredDefaultSite || availableSites[0] || getPublicDefaultSite();
if (configuredDefaultSite && !availableSites.includes(configuredDefaultSite)) {
  availableSites.push(configuredDefaultSite);
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
