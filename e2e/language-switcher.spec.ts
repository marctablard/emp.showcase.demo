import { expect, test } from './fixtures/multilingual-site';

function getLocaleCookieName(): string {
  const configuredCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE?.trim();
  return configuredCookieName && configuredCookieName.length > 0 ? configuredCookieName : 'NEXT_LOCALE';
}

test.describe('Language switcher', () => {
  test('switching to German updates route, document locale, and locale cookie', async ({
    page,
    multilingualSite: _multilingualSite,
  }) => {
    expect(_multilingualSite.englishBrowsePath).toContain('/browse');
    await expect(page).toHaveURL(/\/(?:[^/]+\/)?(?:en\/)?browse(?:\?.*)?$/);

    await page.getByRole('button', { name: 'Languages' }).click();
    await page.getByRole('menuitem', { name: 'German' }).click();

    await expect(page).toHaveURL(/\/(?:[^/]+\/)?de\/browse(?:\?.*)?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    const localeCookieName = getLocaleCookieName();
    const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === localeCookieName);

    expect(localeCookie?.value).toBe('de');

    await page.getByRole('button', { name: 'Sprachen' }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();

    await expect(page).toHaveURL(/\/(?:[^/]+\/)?browse(?:\?.*)?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const englishLocaleCookie = (await page.context().cookies()).find((cookie) => cookie.name === localeCookieName);

    expect(englishLocaleCookie?.value).toBe('en');
  });
});
