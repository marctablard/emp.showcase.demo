import type { LoggerService } from '@/platform/services/logger/LoggerService';

type SiteSwitcherTarget = {
  languages?: string[];
};

type RedirectArgs = {
  href: string;
  locale: string;
  site: string;
  forcePrefix?: boolean;
};

type SwitchSiteAndRedirectParams = {
  site: string;
  locale: string;
  getSiteByCode: (site: string) => Promise<SiteSwitcherTarget | null | undefined>;
  updateSessionSite: (site: string) => Promise<boolean>;
  getRedirectPath: (args: RedirectArgs) => string;
  navigateTo: (path: string) => void;
  logger: LoggerService;
  notifySwitchFailure: () => void;
};

export async function switchSiteAndRedirect({
  site,
  locale,
  getSiteByCode,
  updateSessionSite,
  getRedirectPath,
  navigateTo,
  logger,
  notifySwitchFailure,
}: SwitchSiteAndRedirectParams): Promise<boolean> {
  const siteObject = await getSiteByCode(site);
  if (!siteObject) {
    logger.error({ site }, 'Site not found');
    notifySwitchFailure();
    return false;
  }

  try {
    const success = await updateSessionSite(site);
    if (!success) {
      logger.error({ site }, 'Failed to update session site');
      notifySwitchFailure();
      return false;
    }
  } catch (error) {
    logger.error({ err: error, site }, 'Failed to switch site');
    notifySwitchFailure();
    return false;
  }

  const targetLocale = siteObject.languages?.includes(locale) ? locale : siteObject.languages?.[0] || locale;
  const targetPath = getRedirectPath({
    href: '/',
    locale: targetLocale,
    site,
    forcePrefix: true,
  });
  navigateTo(targetPath);
  return true;
}
