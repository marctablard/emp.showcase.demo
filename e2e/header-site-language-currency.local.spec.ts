/**
 * COP-5852 HeaderTopBanner sequence (local / tenant-dependent).
 *
 * Tenant snapshot from GET http://localhost:3000/api/site/us-branch (2026-08-17):
 * - languages: ["en"]
 * - currencies: USD, CHF
 * - defaultLanguage: "en"
 * - defaultCurrency: USD
 * US does not list `de` or EUR; both locale and currency seams remain in scope.
 * Runtime assertions still discover languages/currencies from GET /api/site
 * (no hardcoded “US has no German” unless that payload says so).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const DEFAULT_SITE_CODE = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
const BOOTSTRAP_ROUTE = '/api/test/auth/bootstrap';
const BOOTSTRAP_HEADER_NAME = 'x-emporix-local-auth-bootstrap';
const BOOTSTRAP_HEADER_VALUE = 'auth-site-sync';
const BOOTSTRAP_TOKEN_HEADER_NAME = 'x-emporix-local-auth-bootstrap-token';
const BOOTSTRAP_TOKEN = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN;
const CURRENCY_COOKIE_NAME = 'next-currency';
const US_SITE_CODE = 'us-branch';
const SHOWCASE_LABEL = 'Showcase';
const US_SITE_LABEL = 'US';
const CURRENCY_SWITCHER_LABEL = 'Währungen';
const CURRENCY_LABEL_FRAGMENT_BY_CODE: Record<string, string> = {
  EUR: 'Euro',
  USD: 'Dollar',
};
const HEADER_CART_NAME = /View shopping cart|Warenkorb anzeigen/;

type SiteCurrency = {
  id?: string;
  code?: string;
};

type SiteSummary = {
  code: string;
  languages?: string[];
  currencies?: Array<SiteCurrency | null | undefined>;
  defaultLanguage?: string;
  defaultCurrency?: SiteCurrency;
};

type SiteApiResponse = {
  current?: SiteSummary;
  available?: SiteSummary[];
};

type SessionPayload = {
  siteCode?: string;
  currency?: string;
  customerId?: string;
};

type UsAgreementSnapshot = {
  pathnameIncludesUsBranch: boolean;
  pathnameStable: boolean;
  htmlLangSupported: boolean;
  localeCookieMatchesHtmlLang: boolean;
  sessionSiteCodeIsUsBranch: boolean;
  sessionCurrencySupported: boolean;
  nextCurrencyMatchesSession: boolean;
  siteSwitcherEnabled: boolean;
  headerCartNotBusy: boolean;
  noUnsupportedDePath: boolean;
};

const US_AGREEMENT: UsAgreementSnapshot = {
  pathnameIncludesUsBranch: true,
  pathnameStable: true,
  htmlLangSupported: true,
  localeCookieMatchesHtmlLang: true,
  sessionSiteCodeIsUsBranch: true,
  sessionCurrencySupported: true,
  nextCurrencyMatchesSession: true,
  siteSwitcherEnabled: true,
  headerCartNotBusy: true,
  noUnsupportedDePath: true,
};

function getLocaleCookieName(): string {
  const configuredCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE?.trim();
  return configuredCookieName && configuredCookieName.length > 0 ? configuredCookieName : 'NEXT_LOCALE';
}

function getSiteCodeFromPath(pathname: string): string {
  const [, firstSegment] = pathname.split('/');
  if (!firstSegment || firstSegment === 'en' || firstSegment === 'de') {
    return DEFAULT_SITE_CODE;
  }
  return firstSegment;
}

function pathnameHasDeLocale(pathname: string): boolean {
  return /(?:^|\/)de(?:\/|$)/.test(pathname);
}

function collectLanguages(site: SiteSummary): string[] {
  return (site.languages ?? []).map((language) => language.toLowerCase());
}

function collectCurrencyCodes(site: SiteSummary): string[] {
  const codes = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value) {
      codes.add(value);
    }
  };
  for (const currency of site.currencies ?? []) {
    add(currency?.id);
    add(currency?.code);
  }
  add(site.defaultCurrency?.id);
  add(site.defaultCurrency?.code);
  return [...codes];
}

function defaultCurrencyCode(site: SiteSummary): string | undefined {
  return site.defaultCurrency?.id || site.defaultCurrency?.code;
}

async function discoverUsBranchSite(page: Page): Promise<SiteSummary> {
  const response = await page.request.get('/api/site');
  expect(response.ok(), `GET /api/site returned ${response.status()}`).toBeTruthy();
  const payload = (await response.json()) as SiteApiResponse;
  const candidates = [payload.current, ...(payload.available ?? [])].filter((site): site is SiteSummary =>
    Boolean(site?.code),
  );
  let usSite = candidates.find((site) => site.code === US_SITE_CODE);
  if (!usSite || collectLanguages(usSite).length === 0) {
    const byId = await page.request.get(`/api/site/${US_SITE_CODE}`);
    expect(byId.ok(), `GET /api/site/${US_SITE_CODE} returned ${byId.status()}`).toBeTruthy();
    usSite = (await byId.json()) as SiteSummary;
  }
  expect(usSite.code).toBe(US_SITE_CODE);
  return usSite;
}

async function revealHeaderTopBanner(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect(page.getByRole('button', { name: 'Site' })).toBeVisible({ timeout: 10_000 });
}

async function landOnShowcase(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await revealHeaderTopBanner(page);
  const siteButton = page.getByRole('button', { name: 'Site' });
  if (!(await siteButton.innerText()).includes(SHOWCASE_LABEL)) {
    await expect(siteButton).toBeEnabled();
    await siteButton.click();
    await page.getByRole('menuitem', { name: SHOWCASE_LABEL }).click();
    await expect.poll(() => getSiteCodeFromPath(new URL(page.url()).pathname)).toBe(DEFAULT_SITE_CODE);
    await revealHeaderTopBanner(page);
  }
  await expect(siteButton).toContainText(SHOWCASE_LABEL);
}

async function bootstrapLoggedInSession(page: Page): Promise<void> {
  const bootstrapResponse = await page.request.post(BOOTSTRAP_ROUTE, {
    headers: {
      [BOOTSTRAP_HEADER_NAME]: BOOTSTRAP_HEADER_VALUE,
      [BOOTSTRAP_TOKEN_HEADER_NAME]: BOOTSTRAP_TOKEN ?? '',
    },
  });
  expect(bootstrapResponse.ok()).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => {
      const sessionResponse = await page.request.get('/api/session');
      const session = (await sessionResponse.json()) as SessionPayload;
      return session.customerId;
    })
    .not.toBe('ANONYMOUS');
}

async function selectHeaderOption(
  page: Page,
  buttonName: string | RegExp,
  menuItemName: string | RegExp,
): Promise<void> {
  await revealHeaderTopBanner(page);
  const trigger = page.getByRole('button', { name: buttonName });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.getByRole('menuitem', { name: menuItemName }).click();
}

async function switchLanguageToGerman(page: Page): Promise<void> {
  const currentLang = await page.locator('html').getAttribute('lang');
  if (currentLang !== 'de') {
    await selectHeaderOption(page, /Languages|Sprachen/, /German|Deutsch/);
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
}

async function switchCurrency(page: Page, currencyCode: 'USD' | 'EUR'): Promise<void> {
  const fragment = CURRENCY_LABEL_FRAGMENT_BY_CODE[currencyCode];
  await selectHeaderOption(page, CURRENCY_SWITCHER_LABEL, new RegExp(fragment, 'i'));
  await expect(page.getByRole('button', { name: CURRENCY_SWITCHER_LABEL })).toContainText(new RegExp(fragment, 'i'));
}

async function cookieValue(page: Page, name: string): Promise<string | undefined> {
  const match = (await page.context().cookies()).find((cookie) => cookie.name === name);
  return match?.value;
}

async function readUsAgreement(
  page: Page,
  usSite: SiteSummary,
  previousPathname: string | undefined,
): Promise<{ snapshot: UsAgreementSnapshot; pathname: string }> {
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  const pathname = new URL(page.url()).pathname;
  const pathnameIncludesUsBranch = pathname.includes(US_SITE_CODE);
  const pathnameStable = previousPathname === pathname && pathnameIncludesUsBranch;
  if (!pathnameStable) {
    return {
      pathname,
      snapshot: {
        pathnameIncludesUsBranch,
        pathnameStable: false,
        htmlLangSupported: false,
        localeCookieMatchesHtmlLang: false,
        sessionSiteCodeIsUsBranch: false,
        sessionCurrencySupported: false,
        nextCurrencyMatchesSession: false,
        siteSwitcherEnabled: false,
        headerCartNotBusy: false,
        noUnsupportedDePath: false,
      },
    };
  }

  const htmlLang = (await page.locator('html').getAttribute('lang'))?.toLowerCase() ?? '';
  const usLanguages = collectLanguages(usSite);
  const usCurrencies = collectCurrencyCodes(usSite);
  const usDefaultCurrency = defaultCurrencyCode(usSite);
  const usListsDe = usLanguages.includes('de');
  const localeCookie = await cookieValue(page, getLocaleCookieName());
  const sessionResponse = await page.request.get('/api/session');
  const session = (await sessionResponse.json()) as SessionPayload;
  const nextCurrency = await cookieValue(page, CURRENCY_COOKIE_NAME);
  const siteSwitcher = page.getByRole('button', { name: 'Site' });
  const cartControl = page.getByRole('link', { name: HEADER_CART_NAME });
  const cartVisible = await cartControl.isVisible();
  const cartBusyCount = await cartControl.locator('[aria-busy]').count();
  const cartSpinnerCount = await cartControl.getByRole('status').count();

  return {
    pathname,
    snapshot: {
      pathnameIncludesUsBranch,
      pathnameStable,
      htmlLangSupported: usLanguages.includes(htmlLang),
      localeCookieMatchesHtmlLang: localeCookie === htmlLang,
      sessionSiteCodeIsUsBranch: session.siteCode === US_SITE_CODE,
      sessionCurrencySupported: Boolean(
        session.currency && (usCurrencies.includes(session.currency) || session.currency === usDefaultCurrency),
      ),
      nextCurrencyMatchesSession: Boolean(session.currency) && nextCurrency === session.currency,
      siteSwitcherEnabled: (await siteSwitcher.isVisible()) && (await siteSwitcher.isEnabled()),
      headerCartNotBusy: cartVisible && cartBusyCount === 0 && cartSpinnerCount === 0,
      noUnsupportedDePath: usListsDe || !pathnameHasDeLocale(pathname),
    },
  };
}

async function runCop5852SequenceAndAssert(page: Page): Promise<void> {
  const usSite = await discoverUsBranchSite(page);

  await switchLanguageToGerman(page);
  await switchCurrency(page, 'USD');
  await switchCurrency(page, 'EUR');
  await selectHeaderOption(page, 'Site', US_SITE_LABEL);

  let previousPathname: string | undefined;
  await expect
    .poll(
      async () => {
        const { snapshot, pathname } = await readUsAgreement(page, usSite, previousPathname);
        previousPathname = pathname;
        return snapshot;
      },
      { timeout: 30_000, intervals: [1_000] },
    )
    .toEqual(US_AGREEMENT);
}

test.describe('COP-5852 header site language currency sequence', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 120_000 });

  test('should keep US interactive after Showcase German USD EUR sequence when logged in', async ({ page }) => {
    test.skip(
      !BOOTSTRAP_TOKEN,
      'Set NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN in .env before running local auth bootstrap specs',
    );

    await landOnShowcase(page);
    await bootstrapLoggedInSession(page);
    await landOnShowcase(page);
    await runCop5852SequenceAndAssert(page);
  });

  test('should keep US interactive after Showcase German USD EUR sequence when anonymous', async ({ page }) => {
    await landOnShowcase(page);
    await runCop5852SequenceAndAssert(page);
  });
});
