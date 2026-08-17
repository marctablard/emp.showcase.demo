/**
 * COP-4998 Account menu Logout reachability (local / authenticated).
 *
 * Proves the phone drawer panel and tablet rail are real overflow scrollports and that
 * scrolling *those* containers (not `document`) brings Logout into the scrollport client
 * rect. Playwright Chromium `vh` ≈ `dvh` — this spec does not prove iOS rubber-band snap-back.
 * COP-4874 jump / breadcrumb / hover-scrollbar behavior is out of scope.
 *
 * Named `*.local.spec.ts` so default `npm run e2e` ignores it. Requires
 * `NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN` (fails closed; does not skip).
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const BOOTSTRAP_ROUTE = '/api/test/auth/bootstrap';
const BOOTSTRAP_HEADER_NAME = 'x-emporix-local-auth-bootstrap';
const BOOTSTRAP_HEADER_VALUE = 'auth-site-sync';
const BOOTSTRAP_TOKEN_HEADER_NAME = 'x-emporix-local-auth-bootstrap-token';
const BOOTSTRAP_TOKEN = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN;

/** Profile is a short-main Account page; dashboard is not assumed shorter than the ~1272px nav. */
const SHORT_MAIN_ACCOUNT_PATH = '/account/profile';
const MOBILE_BOTTOM_BAR_PX = 58;

const ACCOUNT_MENU_NAME = /Account Menu|Kundenkonto Menü/;
const LOGOUT_NAME = /^(Logout|Abmelden)$/;

type ScrollportRect = {
  scrollHeight: number;
  clientHeight: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
};

type LogoutReachability = {
  scrollHeight: number;
  clientHeight: number;
  logoutTop: number;
  logoutLeft: number;
  logoutBottom: number;
  logoutRight: number;
  portTop: number;
  portLeft: number;
  portBottom: number;
  portRight: number;
  viewportHeight: number;
  scrolledDocument: boolean;
};

test.describe('COP-4998 Account menu Logout reachability', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('phone drawer (<768)', () => {
    test.use({ viewport: { width: 360, height: 640 } });

    test('should scroll the drawer panel to Logout above the 58px bar when the phone viewport is shorter than the nav', async ({
      page,
    }) => {
      await bootstrapAuthenticatedSession(page);
      await openShortMainAccountPage(page);

      await expect(accountMenuButton(page)).toBeVisible();
      await accountMenuButton(page).click();

      const accountNav = accountNavigation(page);
      await expect(accountNav).toBeVisible();

      const reachability = await scrollAccountScrollportToLogout(page, accountNav, 'drawer');

      expect(
        reachability.scrollHeight,
        'Drawer panel must be a real scrollport (scrollHeight > clientHeight)',
      ).toBeGreaterThan(reachability.clientHeight);
      expect(
        reachability.scrolledDocument,
        'Page / document scroll is not success; the drawer panel must be the scrolled container',
      ).toBe(false);
      expectLogoutInsideScrollport(reachability);
      expect(reachability.logoutBottom).toBeLessThanOrEqual(reachability.viewportHeight - MOBILE_BOTTOM_BAR_PX + 1);
    });
  });

  test.describe('tablet rail portrait (768x1024)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should scroll the rail nav to Logout when tablet portrait is 768x1024', async ({ page }) => {
      await bootstrapAuthenticatedSession(page);
      await openShortMainAccountPage(page);
      await expectAccountRail(page);

      const reachability = await scrollAccountScrollportToLogout(page, accountNavigation(page), 'rail');

      expect(
        reachability.scrollHeight,
        'Tablet rail must be a real scrollport (scrollHeight > clientHeight)',
      ).toBeGreaterThan(reachability.clientHeight);
      expect(
        reachability.scrolledDocument,
        'Page / document scroll is not success; the rail nav must be the scrolled container',
      ).toBe(false);
      expectLogoutInsideScrollport(reachability);
    });
  });

  test.describe('tablet rail landscape-short (1024x768)', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test('should scroll the rail nav to Logout when tablet landscape height is shorter than the nav', async ({
      page,
    }) => {
      await bootstrapAuthenticatedSession(page);
      await openShortMainAccountPage(page);
      await expectAccountRail(page);

      const reachability = await scrollAccountScrollportToLogout(page, accountNavigation(page), 'rail');

      expect(
        reachability.scrollHeight,
        'Tablet rail must be a real scrollport (scrollHeight > clientHeight)',
      ).toBeGreaterThan(reachability.clientHeight);
      expect(
        reachability.scrolledDocument,
        'Page / document scroll is not success; the rail nav must be the scrolled container',
      ).toBe(false);
      expectLogoutInsideScrollport(reachability);
    });
  });
});

async function bootstrapAuthenticatedSession(page: Page): Promise<void> {
  expect(
    BOOTSTRAP_TOKEN,
    'Set NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN in .env before running local auth bootstrap specs',
  ).toBeTruthy();

  await page.goto('/');

  const bootstrapResponse = await page.request.post(BOOTSTRAP_ROUTE, {
    headers: {
      [BOOTSTRAP_HEADER_NAME]: BOOTSTRAP_HEADER_VALUE,
      [BOOTSTRAP_TOKEN_HEADER_NAME]: BOOTSTRAP_TOKEN ?? '',
    },
  });

  if (bootstrapResponse.status() === 404) {
    throw new Error(
      'Stop Rule: POST /api/test/auth/bootstrap is unavailable (404). Do not fake cookies or bypass login.',
    );
  }

  expect(bootstrapResponse.ok()).toBeTruthy();

  await expect
    .poll(async () => {
      const sessionResponse = await page.request.get('/api/session');
      const session = (await sessionResponse.json()) as { customerId?: string };
      return session.customerId;
    })
    .not.toBe('ANONYMOUS');
}

async function openShortMainAccountPage(page: Page): Promise<void> {
  await page.goto(SHORT_MAIN_ACCOUNT_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account\/profile/);
}

function accountMenuButton(page: Page): Locator {
  return page.getByRole('button', { name: ACCOUNT_MENU_NAME });
}

function logoutButton(page: Page): Locator {
  return page.getByRole('button', { name: LOGOUT_NAME });
}

function accountNavigation(page: Page): Locator {
  return page.getByRole('navigation').filter({ has: logoutButton(page) });
}

async function expectAccountRail(page: Page): Promise<void> {
  await expect(accountMenuButton(page)).toHaveCount(0);
  await expect(accountNavigation(page)).toBeVisible();
}

function expectLogoutInsideScrollport(reachability: LogoutReachability): void {
  const epsilon = 1;
  expect(
    reachability.logoutTop,
    'Logout must sit inside the Account scrollport client rect (scrollIntoViewIfNeeded on the page is not success)',
  ).toBeGreaterThanOrEqual(reachability.portTop - epsilon);
  expect(reachability.logoutLeft).toBeGreaterThanOrEqual(reachability.portLeft - epsilon);
  expect(reachability.logoutBottom).toBeLessThanOrEqual(reachability.portBottom + epsilon);
  expect(reachability.logoutRight).toBeLessThanOrEqual(reachability.portRight + epsilon);
}

async function scrollAccountScrollportToLogout(
  page: Page,
  accountNav: Locator,
  mode: 'drawer' | 'rail',
): Promise<LogoutReachability> {
  const logout = logoutButton(page);
  await expect(logout).toBeAttached();

  const documentScrollBefore = await readDocumentScrollTop(page);

  return accountNav.evaluate(
    (navEl, args) => {
      const nav = navEl as HTMLElement;
      const logoutEl = Array.from(nav.querySelectorAll('button')).find((button) =>
        /^(Logout|Abmelden)$/.test((button.textContent || '').replace(/\s+/g, ' ').trim()),
      );
      if (!logoutEl) {
        throw new Error('Logout is not inside an Account navigation');
      }

      const scrollport = args.mode === 'rail' ? nav : nearestOverflowAncestor(nav);
      if (scrollport === document.documentElement || scrollport === document.body) {
        throw new Error('Account scrollport must not be the document');
      }

      const metricsBefore = readScrollport(scrollport);
      scrollport.scrollTop = scrollport.scrollHeight;

      const metricsAfter = readScrollport(scrollport);
      const logoutBox = logoutEl.getBoundingClientRect();
      const documentEl = document.scrollingElement ?? document.documentElement;

      return {
        scrollHeight: metricsBefore.scrollHeight,
        clientHeight: metricsBefore.clientHeight,
        logoutTop: logoutBox.top,
        logoutLeft: logoutBox.left,
        logoutBottom: logoutBox.bottom,
        logoutRight: logoutBox.right,
        portTop: metricsAfter.top,
        portLeft: metricsAfter.left,
        portBottom: metricsAfter.bottom,
        portRight: metricsAfter.right,
        viewportHeight: window.innerHeight,
        scrolledDocument: documentEl.scrollTop !== args.documentScrollBefore,
      };

      function nearestOverflowAncestor(start: HTMLElement): HTMLElement {
        let current: HTMLElement | null = start.parentElement;
        while (current && current !== document.body) {
          const overflowY = window.getComputedStyle(current).overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return current;
          }
          current = current.parentElement;
        }
        throw new Error('Expected the Account Menu drawer panel to be an overflow-y scrollport');
      }

      function readScrollport(el: HTMLElement): ScrollportRect {
        const rect = el.getBoundingClientRect();
        return {
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          top: rect.top,
          left: rect.left,
          bottom: rect.top + el.clientHeight,
          right: rect.left + el.clientWidth,
        };
      }
    },
    { mode, documentScrollBefore },
  );
}

async function readDocumentScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop);
}
