/**
 * Acceptance contract for the preview-route layout (EMP-22 / EMP-25).
 *
 * The preview route lives OUTSIDE the `[site]/[locale]` route group, so the
 * production layout's provider stack never wraps it. EMP-15 shipped a minimal
 * stub (only `NextIntlClientProvider`), which still crashes on the Storyblok
 * happy path because mapped CMS components reach `useSessionStore` and there is
 * no `<StoreProvider>` above them (see EMP-22 plan §1).
 *
 * These tests are WRITTEN BEFORE the implementation (EMP-24) and MUST run red
 * against the current stub. They are the contract: the layout has to mount
 * `<html lang>` + `<body>` and replicate the production provider chain
 *   AuthSessionProvider → SiteProvider → NextIntlClientProvider → StoreProvider
 * (plus `SiteThemeStyle`, `CsrfProvider`, `SiteSessionAligner`, `CurrencyUrlAligner`, `CurrencyCookieAligner`), while
 * deliberately EXCLUDING the editor-irrelevant chrome (`CmsBridgeScript`,
 * `Toaster`, `Notification`, dialog slot — plan §3 lower list).
 *
 * Behaviour assertions (plan §3 / §9):
 *  - `notFound()` on locale mismatch (`!hasLocale`)            — AC implied by §3
 *  - `notFound()` when `getSite(siteCode)` returns `null`      — §3
 *  - tolerates `getSessionForSite(siteCode) → null` (anonymous editor) — AC-4
 *
 * Mock strategy (plan §8 / issue):
 *  - Provider components are pass-through / leaf stubs that stamp a
 *    `data-provider="<name>"` attribute so nesting order is assertable.
 *  - `getSite` / `getAvailableSites` / `getSessionForSite` are module mocks.
 *  - `notFound` throws (mirrors the real control-flow halt) and is spied.
 *  - `setRequestLocale` is spied; `next/font/google` is mocked (CI-stable).
 *  - This file overrides the minimal global `next-intl` mock from
 *    `jest.react.setup.js` to also expose `NextIntlClientProvider` + `hasLocale`.
 */
import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { render } from '@testing-library/react';
import { getSessionForSite } from '@/lib/ssr/session';
import { getAvailableSites, getSite } from '@/lib/ssr/site';

// --- next/font/google: deterministic, no network -----------------------------
jest.mock('next/font/google', () => ({
  Ubuntu: () => ({ variable: '--font-headlines', className: 'mock-ubuntu' }),
  Open_Sans: () => ({ variable: '--font-body', className: 'mock-open-sans' }),
}));

// --- next-intl: stub the client provider + real-ish hasLocale ----------------
// The global setup mock (jest.react.setup.js) only exposes useLocale/useTranslations;
// the layout additionally needs NextIntlClientProvider + hasLocale.
jest.mock('next-intl', () => ({
  __esModule: true,
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
  NextIntlClientProvider: ({ children }: { children?: ReactNode }) => (
    <div data-provider="NextIntlClientProvider">{children}</div>
  ),
}));

jest.mock('next-intl/server', () => ({
  __esModule: true,
  setRequestLocale: jest.fn(),
}));

// --- next/navigation: notFound() halts rendering (throws), spied -------------
const NOT_FOUND = new Error('NEXT_NOT_FOUND');
jest.mock('next/navigation', () => ({
  __esModule: true,
  notFound: jest.fn(() => {
    throw NOT_FOUND;
  }),
}));

// --- SSR helpers: module mocks ------------------------------------------------
jest.mock('@/lib/ssr/session', () => ({
  __esModule: true,
  getSessionForSite: jest.fn(),
}));
jest.mock('@/lib/ssr/site', () => ({
  __esModule: true,
  getSite: jest.fn(),
  getAvailableSites: jest.fn(),
}));

jest.mock('@/site/server/', () => ({
  __esModule: true,
  setRequestSite: jest.fn(),
}));

// --- Provider components: pass-through / leaf stubs with data-provider --------
jest.mock('next-auth/react', () => ({
  __esModule: true,
  SessionProvider: ({ children }: { children?: ReactNode }) => (
    <div data-provider="AuthSessionProvider">{children}</div>
  ),
}));
jest.mock('@/providers/SiteProvider', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <div data-provider="SiteProvider">{children}</div>,
}));
jest.mock('@/providers/StoreProvider', () => ({
  __esModule: true,
  StoreProvider: ({ children }: { children?: ReactNode }) => <div data-provider="StoreProvider">{children}</div>,
}));
jest.mock('@/providers/SiteSessionAligner', () => ({
  __esModule: true,
  SiteSessionAligner: () => <div data-provider="SiteSessionAligner" />,
}));
jest.mock('@/providers/CurrencyUrlAligner', () => ({
  __esModule: true,
  CurrencyUrlAligner: () => <div data-provider="CurrencyUrlAligner" />,
}));
jest.mock('@/providers/CurrencyCookieAligner', () => ({
  __esModule: true,
  CurrencyCookieAligner: () => <div data-provider="CurrencyCookieAligner" />,
}));
jest.mock('@/components/csrf/CsrfProvider', () => ({
  __esModule: true,
  CsrfProvider: () => <div data-provider="CsrfProvider" />,
}));
jest.mock('@/components/theme/site-theme-style', () => ({
  __esModule: true,
  SiteThemeStyle: () => <div data-provider="SiteThemeStyle" />,
}));

const mockGetSite = getSite as jest.Mock;
const mockGetAvailableSites = getAvailableSites as jest.Mock;
const mockGetSessionForSite = getSessionForSite as jest.Mock;
const mockNotFound = notFound as unknown as jest.Mock;
const mockSetRequestLocale = setRequestLocale as unknown as jest.Mock;

const SITE = { code: 'main', languages: ['en', 'de'] };
const CHILD_TESTID = 'preview-child';

/**
 * Render the async server layout. `params` is a Promise (Next.js 15 contract).
 * Returns the RTL result so callers can query the produced DOM tree.
 */
async function renderLayout(overrides: { site?: string; locale?: string } = {}): Promise<ReturnType<typeof render>> {
  const { default: PreviewLocaleLayout } = await import('@/app/preview/[site]/[locale]/[[...slug]]/layout');
  const params = Promise.resolve({
    site: overrides.site ?? 'main',
    locale: overrides.locale ?? 'en',
  });
  const ui = await PreviewLocaleLayout({
    children: <span data-testid={CHILD_TESTID}>preview-content</span>,
    params,
  });
  return render(ui);
}

beforeEach(() => {
  jest.clearAllMocks();
  // `jest.react.setup.js` runs `afterEach(jest.resetAllMocks())`, which wipes the
  // implementations declared in the mock factories above. Re-establish the ones
  // whose behaviour matters here (the plain function-component stubs survive a
  // reset; only `jest.fn()` mocks need re-seeding).
  mockNotFound.mockImplementation(() => {
    throw NOT_FOUND;
  });
  mockGetSite.mockResolvedValue(SITE);
  mockGetAvailableSites.mockResolvedValue([SITE]);
  mockGetSessionForSite.mockResolvedValue({ token: 'abc' });
});

describe('PreviewLocaleLayout', () => {
  it('rendert html/body + vollständige Provider-Kette in dokumentierter Reihenfolge', async () => {
    const { container, getByTestId } = await renderLayout({ locale: 'en' });

    // <html lang> + <body>.
    // React 19 treats <html>/<head>/<body> as document SINGLETONS: their attributes
    // are applied to the real `document.documentElement` / `document.body` and the
    // body's children render into the RTL container — the wrapper elements never land
    // inside `container`. So `container.querySelector('html')` is always null for a
    // correct root layout; the rendered `<html lang>` / `<body>` are asserted on the
    // document instead (verified empirically against React 19 + RTL).
    const html = document.documentElement;
    const body = document.body;
    expect(html).not.toBeNull();
    expect(html).toHaveAttribute('lang', 'en');
    expect(body).not.toBeNull();

    // Provider chain present
    const auth = container.querySelector('[data-provider="AuthSessionProvider"]');
    const siteProvider = container.querySelector('[data-provider="SiteProvider"]');
    const intl = container.querySelector('[data-provider="NextIntlClientProvider"]');
    const store = container.querySelector('[data-provider="StoreProvider"]');
    expect(auth).not.toBeNull();
    expect(siteProvider).not.toBeNull();
    expect(intl).not.toBeNull();
    expect(store).not.toBeNull();

    // Documented nesting order: Auth → Site → Intl → Store → children
    expect(auth).toContainElement(siteProvider as HTMLElement);
    expect(siteProvider).toContainElement(intl as HTMLElement);
    expect(intl).toContainElement(store as HTMLElement);
    expect(store).toContainElement(getByTestId(CHILD_TESTID));

    // Supporting providers mounted inside StoreProvider
    expect(store).toContainElement(container.querySelector('[data-provider="CsrfProvider"]') as HTMLElement);
    expect(store).toContainElement(container.querySelector('[data-provider="SiteSessionAligner"]') as HTMLElement);
    expect(store).toContainElement(container.querySelector('[data-provider="CurrencyUrlAligner"]') as HTMLElement);
    expect(store).toContainElement(container.querySelector('[data-provider="CurrencyCookieAligner"]') as HTMLElement);

    // Per-site theme is wired (sibling of the auth provider inside body)
    expect(container.querySelector('[data-provider="SiteThemeStyle"]')).not.toBeNull();

    expect(mockSetRequestLocale).toHaveBeenCalledWith('en');
  });

  it('ruft notFound() wenn Locale nicht in routing.locales ist', async () => {
    await expect(renderLayout({ locale: 'fr' })).rejects.toBe(NOT_FOUND);
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    // Must short-circuit before touching site/session SSR helpers.
    expect(mockGetSite).not.toHaveBeenCalled();
  });

  it('ruft notFound() wenn getSite(siteCode) null liefert', async () => {
    mockGetSite.mockResolvedValue(null);
    await expect(renderLayout({ locale: 'en', site: 'ghost' })).rejects.toBe(NOT_FOUND);
    expect(mockGetSite).toHaveBeenCalledWith('ghost');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('rendert ohne zu werfen wenn getSessionForSite(siteCode) null liefert (anonymer Editor)', async () => {
    mockGetSessionForSite.mockResolvedValue(null);

    const { container, getByTestId } = await renderLayout({ locale: 'en' });

    expect(mockNotFound).not.toHaveBeenCalled();
    // StoreProvider must still mount and wrap the children even with a null session.
    const store = container.querySelector('[data-provider="StoreProvider"]');
    expect(store).not.toBeNull();
    expect(store).toContainElement(getByTestId(CHILD_TESTID));
  });

  it('schließt CmsBridgeScript / Toaster / Notification / dialog-Slot bewusst aus', async () => {
    const { container, queryByTestId } = await renderLayout({ locale: 'en' });

    // No CMS editing bridge (page.tsx / adapter owns it — plan §3).
    expect(container.querySelector('[data-provider="CmsBridgeScript"]')).toBeNull();
    expect(container.querySelector('[data-cms-bridge]')).toBeNull();
    // No toast / notification chrome inside the editor iframe.
    expect(container.querySelector('[data-sonner-toaster]')).toBeNull();
    expect(queryByTestId('notification')).toBeNull();
    // No parallel dialog slot is accepted/rendered by the preview layout.
    expect(queryByTestId('dialog-slot')).toBeNull();
  });
});
