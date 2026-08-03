import { test as base, expect } from '@playwright/test';

type SiteSummary = {
  code: string;
  languages?: string[];
};

type SiteApiResponse = {
  current?: SiteSummary;
  available?: SiteSummary[];
};

type MultilingualSiteContext = {
  siteCode: string;
  englishBrowsePath: string;
  germanBrowsePath: string;
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

    if (isMultilingual(current)) {
      const englishBrowsePath = buildEnglishBrowsePath(current.code, true);
      await page.goto(englishBrowsePath, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      await provideFixture({
        siteCode: current.code,
        englishBrowsePath,
        germanBrowsePath: englishBrowsePath.replace('/en/browse', '/de/browse'),
      });
      return;
    }

    const multilingualAlternatives = available
      .filter(isMultilingual)
      .sort((left, right) => left.code.localeCompare(right.code));

    const selected = multilingualAlternatives[0];
    if (!selected) {
      throw new Error(buildContractErrorMessage('GET /api/site returned no multilingual site candidate'));
    }

    const englishBrowsePath = buildEnglishBrowsePath(selected.code, false);
    await page.goto(englishBrowsePath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await provideFixture({
      siteCode: selected.code,
      englishBrowsePath,
      germanBrowsePath: englishBrowsePath.replace('/en/browse', '/de/browse'),
    });
  },
});

export { expect };
