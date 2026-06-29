import { expect, test } from '@playwright/test';

async function expectHomepageShell(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await expect(page.locator('header > div').first()).toBeVisible();
}

async function getActiveLocale(page: Parameters<typeof test>[0]['page']): Promise<string> {
  const activeLocale = await page.locator('html').getAttribute('lang');

  expect(activeLocale).toBeTruthy();

  return activeLocale!;
}

/**
 * Test suite for the Emporix Showcase homepage
 * Tests basic functionality like loading and locale redirects
 */
test.describe('Homepage Tests', () => {
  // Base URL is configured in playwright.config.ts

  test('Root URL (/) loads the homepage using the active default locale', async ({ page }) => {
    // Navigate to the root URL
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expectHomepageShell(page);

    // Check the URL is correct
    expect(new URL(page.url()).pathname).toBe('/');

    await getActiveLocale(page);
  });

  test('Current default-locale path resolves to the same homepage locale as root', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectHomepageShell(page);

    const defaultLocale = await getActiveLocale(page);

    await page.goto(`/${defaultLocale}`, { waitUntil: 'domcontentloaded' });
    await expectHomepageShell(page);

    expect(await getActiveLocale(page)).toBe(defaultLocale);
    expect(['/', `/${defaultLocale}`]).toContain(new URL(page.url()).pathname);
  });
});
