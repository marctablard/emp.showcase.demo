import { expect, test } from '@playwright/test';

const LOGIN_EMAIL = process.env.E2E_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD;
const DEFAULT_SITE_CODE = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
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

test.describe('Auth + Site synchronization', () => {
  test.skip(!LOGIN_EMAIL || !LOGIN_PASSWORD, 'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run auth sync tests.');

  test('post-login URL site segment matches session site and header stays consistent after post-login switch', async ({
    page,
  }) => {
    await page.goto('/');

    // Pre-login: switch to US to reproduce canonicalization handoff path.
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(page.locator('button[aria-label="Site"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Site"]').click();
    await page.getByRole('menuitem', { name: 'US' }).click();
    await expect(page).toHaveURL(/\/us-branch/);

    await page.goto('/us-branch/login');

    // Wait for the form to be fully hydrated before interacting.
    // Playwright's fill() can race with React hydration on controlled inputs,
    // causing the filled values to be overwritten by the default empty state.
    const usernameInput = page.getByTestId('login-username');
    await expect(usernameInput).toBeVisible({ timeout: 15_000 });

    await usernameInput.fill(LOGIN_EMAIL!);
    await page.getByTestId('login-password').fill(LOGIN_PASSWORD!);

    const submitButton = page.getByTestId('login-submitButton');
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });
    await submitButton.click();

    // Wait for authenticated landing to settle.
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

    // Post-login: switch site and assert header/site/currency consistency.
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(page.locator('button[aria-label="Site"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Site"]').click();
    await page.getByRole('menuitem', { name: 'US' }).click();

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
