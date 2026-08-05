import { expect, test } from './fixtures/multilingual-site';

function getLocaleCookieName(): string {
  const configuredCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE?.trim();
  return configuredCookieName && configuredCookieName.length > 0 ? configuredCookieName : 'NEXT_LOCALE';
}

test.describe('Language switcher', () => {
  test('default multilingual site supports German and reverse English route/cookie recovery', async ({
    page,
    multilingualSite,
  }) => {
    await page.goto(multilingualSite.defaultEnglishBrowsePath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: 'Languages' }).click();
    await page.getByRole('menuitem', { name: 'German' }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/de/browse');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    const localeCookieName = getLocaleCookieName();
    const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === localeCookieName);

    expect(localeCookie?.value).toBe('de');

    await page.getByRole('button', { name: 'Sprachen' }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/browse');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const englishLocaleCookie = (await page.context().cookies()).find((cookie) => cookie.name === localeCookieName);

    expect(englishLocaleCookie?.value).toBe('en');
  });

  test('non-default multilingual site keeps site-before-locale route ordering', async ({ page, multilingualSite }) => {
    await page.goto(multilingualSite.prefixedEnglishBrowsePath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: 'Languages' }).click();
    await page.getByRole('menuitem', { name: 'German' }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${multilingualSite.prefixedSiteCode}/de/browse`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    const localeCookieName = getLocaleCookieName();
    const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === localeCookieName);
    expect(localeCookie?.value).toBe('de');
  });
});
