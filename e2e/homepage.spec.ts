import { expect, test } from '@playwright/test';

/**
 * Test suite for the Emporix Showcase homepage
 * Tests basic functionality like loading and locale redirects
 */
test.describe('Homepage Tests', () => {
  // Base URL is configured in playwright.config.ts

  test('German homepage (/de) loads correctly', async ({ page }) => {
    // Navigate to the German homepage
    await page.goto('/de');

    // Verify the page has loaded by checking for expected elements
    // The header element contains fixed-positioned children, so we check for the first visible child div
    await expect(page.locator('header > div').first()).toBeVisible();

    // Check that we're on the German version by looking for German Locale
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('de'); // German

    // Check the URL is correct
    expect(page.url()).toContain('/de');
  });

  test('Default locale (/en) redirects to root (/)', async ({ page }) => {
    // Navigate to the English homepage
    await page.goto('/en');

    // Wait for any redirects to complete
    await page.waitForURL('/');

    // Verify we've been redirected to the root URL
    expect(page.url()).toContain('/');

    // Check that we're on the English version by looking for English Locale
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('en'); // English
  });

  test('Root URL (/) loads the default English locale', async ({ page }) => {
    // Navigate to the root URL
    await page.goto('/');

    // Verify the page has loaded by checking for the fixed header container
    await expect(page.locator('header > div').first()).toBeVisible();

    // Check the URL is correct
    expect(page.url()).toContain('/');

    // Check that we're on the English version by looking for English Locale
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('en'); // English
  });
});
