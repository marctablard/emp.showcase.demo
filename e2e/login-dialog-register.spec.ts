import { expect, test } from '@playwright/test';

test.describe('Login dialog → registration', () => {
  test('Create account from intercepted login navigates to /register', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: /^login$/i }).click();

    await expect(page.getByTestId('login-username')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('login-createAccount').click();

    await expect(page).toHaveURL(/\/register(\?|$)/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /registration/i }).first()).toBeVisible();
  });
});
