import { expect, test } from '@playwright/test';

test.describe('Login dialog → registration', () => {
  test('Create account from intercepted login navigates to /register', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('login-username')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('login-createAccount').click();

    await expect(page).toHaveURL(/\/register(\?|$)/, { timeout: 15_000 });
    await expect(page.getByTestId('register-submitButton')).toBeVisible({ timeout: 15_000 });
  });
});
