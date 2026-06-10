import { expect, test } from '@playwright/test';

/**
 * Desktop flyout: /browse → pick a category → return via "Show all" in the first column.
 * Category-trees are loaded on the server (RSC); count Emporix calls in the dev terminal
 * by grepping for `/category-trees` after this run — with `unstable_cache` + nav-shell,
 * soft navigations should not re-run the cached loader until redeploy / revalidateTag.
 */
test.describe('Navigation flyout and browse (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('browse → category from flyout uses breadcrumb filter → clear filter returns to browse', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /all products/i })).toBeVisible({ timeout: 30_000 });

    const allProducts = page.getByRole('button', { name: /all products/i });
    await allProducts.hover();
    await page.waitForTimeout(300);

    const categoryInFlyout = page.locator('header a[href*="_product_i18n.categories.breadcrumbs.displayPath"]').first();
    await expect(categoryInFlyout).toBeVisible({ timeout: 10_000 });
    await categoryInFlyout.click();
    await page.waitForURL(/_product_i18n\.categories\.breadcrumbs\.displayPath/i, { timeout: 15_000 });

    const clearFilter = page.getByRole('button', { name: /clear filter/i });
    await expect(clearFilter).toBeVisible({ timeout: 10_000 });
    await clearFilter.click();
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/browse') &&
        !url.search.includes('_product_i18n.categories.breadcrumbs.displayPath') &&
        !url.search.includes('categoryIds'),
      { timeout: 15_000 },
    );
  });
});
