import { expect, test as base } from '@playwright/test';

export { expect };

type SiteSummary = {
  code: string;
  languages?: string[];
};

type SiteApiResponse = {
  current?: SiteSummary;
  available?: SiteSummary[];
};

type MultilingualSiteContext = {
  defaultSiteCode: string;
  defaultEnglishBrowsePath: string;
  prefixedSiteCode: string;
  prefixedEnglishBrowsePath: string;
};

const REQUIRED_LOCALES = ['en', 'de'] as const;

function normalizeLanguages(site: SiteSummary | undefined): string[] {
  if (!site?.languages || !Array.isArray(site.languages)) {
    return [];
  }

  return site.languages.map((language) => language.toLowerCase());
}

function isMultilingual(site: SiteSummary | undefined): site is SiteSummary {
  const languages = normalizeLanguages(site);
  return REQUIRED_LOCALES.every((locale) => languages.includes(locale));
}

function buildEnglishBrowsePath(siteCode: string, isCurrent: boolean): string {
  return isCurrent ? '/en/browse' : `/${siteCode}/en/browse`;
}

function buildContractErrorMessage(detail: string): string {
  return `E2E environment contract failed for language switch regression: ${detail}. Configure at least one site in /api/site with both locales en and de.`;
}

export const test = base.extend<{ multilingualSite: MultilingualSiteContext }>({
  multilingualSite: async ({ page }, provideFixture) => {
    const response = await page.request.get('/api/site');

    if (!response.ok()) {
      throw new Error(
        buildContractErrorMessage(`GET /api/site returned ${response.status()} ${response.statusText()}`),
      );
    }

    const payload = (await response.json()) as SiteApiResponse;
    const current = payload.current;
    const available = Array.isArray(payload.available) ? payload.available : [];

    if (!isMultilingual(current)) {
      throw new Error(buildContractErrorMessage('GET /api/site current site does not support both locales en and de'));
    }

    const prefixedMultilingualAlternatives = available
      .filter((site) => site.code !== current.code)
      .filter(isMultilingual)
      .sort((left, right) => left.code.localeCompare(right.code));

    const prefixedSite = prefixedMultilingualAlternatives[0];
    if (!prefixedSite) {
      throw new Error(
        buildContractErrorMessage('GET /api/site returned no distinct multilingual non-default site candidate'),
      );
    }

    const defaultEnglishBrowsePath = buildEnglishBrowsePath(current.code, true);
    await page.goto(defaultEnglishBrowsePath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const prefixedEnglishBrowsePath = buildEnglishBrowsePath(prefixedSite.code, false);
    await page.goto(prefixedEnglishBrowsePath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await provideFixture({
      defaultSiteCode: current.code,
      defaultEnglishBrowsePath,
      prefixedSiteCode: prefixedSite.code,
      prefixedEnglishBrowsePath,
    });
  },
});
