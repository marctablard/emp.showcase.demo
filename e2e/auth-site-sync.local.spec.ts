import { expect, test } from '@playwright/test';

const DEFAULT_SITE_CODE = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
const BOOTSTRAP_ROUTE = '/api/test/auth/bootstrap';
const BOOTSTRAP_HEADER_NAME = 'x-emporix-local-auth-bootstrap';
const BOOTSTRAP_HEADER_VALUE = 'auth-site-sync';
const BOOTSTRAP_TOKEN_HEADER_NAME = 'x-emporix-local-auth-bootstrap-token';
const BOOTSTRAP_TOKEN = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN;
const SITE_LABEL_BY_CODE: Record<string, string> = {
  main: 'Showcase',
  'us-branch': 'US',
};
const CURRENCY_LABEL_FRAGMENT_BY_CODE: Record<string, string> = {
  EUR: 'Euro',
  USD: 'Dollar',
};

function getSiteCodeFromPath(pathname: string): string {
  const [, firstSegment] = pathname.split('/');
  if (!firstSegment || firstSegment === 'en' || firstSegment === 'de') {
    return DEFAULT_SITE_CODE;
  }
  return firstSegment;
}

function getAlternateSiteCode(currentSiteCode: string): string {
  return currentSiteCode === 'us-branch' ? 'main' : 'us-branch';
}

test.describe('Auth + Site synchronization', () => {
  test('bootstrap-authenticated /api/session state stays aligned with URL and header after a site switch', async ({
    page,
  }) => {
    expect(
      BOOTSTRAP_TOKEN,
      'Set NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN in .env before running local auth bootstrap specs',
    ).toBeTruthy();

    await page.goto('/');

    // Start on US before bootstrap so the request-scoped shopper session is created against the
    // same site/currency handoff this scenario has historically asserted via `/api/session`.
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(page.locator('button[aria-label="Site"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Site"]').click();
    await page.getByRole('menuitem', { name: 'US' }).click();
    await expect(page).toHaveURL(/\/us-branch/);

    const bootstrapResponse = await page.request.post(BOOTSTRAP_ROUTE, {
      headers: {
        [BOOTSTRAP_HEADER_NAME]: BOOTSTRAP_HEADER_VALUE,
        [BOOTSTRAP_TOKEN_HEADER_NAME]: BOOTSTRAP_TOKEN ?? '',
      },
    });
    expect(bootstrapResponse.ok()).toBeTruthy();

    await page.reload();

    await expect
      .poll(async () => {
        const sessionResponse = await page.request.get('/api/session');
        const session = (await sessionResponse.json()) as { customerId?: string };
        return session.customerId;
      })
      .not.toBe('ANONYMOUS');

    const sessionResponse = await page.request.get('/api/session');
    const session = (await sessionResponse.json()) as { siteCode: string; currency: string };

    const urlSiteCode = getSiteCodeFromPath(new URL(page.url()).pathname);
    expect(urlSiteCode).toBe(session.siteCode);

    const targetSiteCode = getAlternateSiteCode(session.siteCode);
    const targetSiteLabel = SITE_LABEL_BY_CODE[targetSiteCode] || targetSiteCode;

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(page.locator('button[aria-label="Site"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Site"]').click();
    await page.getByRole('menuitem', { name: targetSiteLabel }).click();

    await expect
      .poll(async () => {
        const latestSessionResponse = await page.request.get('/api/session');
        const latestSession = (await latestSessionResponse.json()) as { siteCode: string; currency: string };

        const dropdownTexts = await page
          .locator('header button[data-slot="dropdown-menu-trigger"]')
          .evaluateAll((elements) => elements.slice(0, 3).map((el) => (el.textContent || '').trim()));

        const siteLabel = dropdownTexts[0] || '';
        const currencyLabel = dropdownTexts[2] || '';
        const expectedSiteLabel = SITE_LABEL_BY_CODE[latestSession.siteCode] || latestSession.siteCode;
        const expectedCurrencyFragment =
          CURRENCY_LABEL_FRAGMENT_BY_CODE[latestSession.currency] || latestSession.currency;

        return {
          siteMatches: siteLabel === expectedSiteLabel,
          currencyMatches: currencyLabel.includes(expectedCurrencyFragment),
          urlMatchesSession: getSiteCodeFromPath(new URL(page.url()).pathname) === latestSession.siteCode,
        };
      })
      .toEqual({
        siteMatches: true,
        currencyMatches: true,
        urlMatchesSession: true,
      });
  });
});
