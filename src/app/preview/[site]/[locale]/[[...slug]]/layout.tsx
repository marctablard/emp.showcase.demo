import type { ReactNode } from 'react';
import { SessionProvider as AuthSessionProvider } from 'next-auth/react';
import { type Locale, NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Open_Sans, Ubuntu } from 'next/font/google';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { CsrfProvider } from '@/components/csrf/CsrfProvider';
import { SiteThemeStyle } from '@/components/theme/site-theme-style';
import { routing } from '@/i18n/routing';
import { getSessionForSite } from '@/lib/ssr/session';
import { getAvailableSites, getSite } from '@/lib/ssr/site';
import SiteProvider from '@/providers/SiteProvider';
import { SiteSessionAligner } from '@/providers/SiteSessionAligner';
import { StoreProvider } from '@/providers/StoreProvider';
import { setRequestSite } from '@/site/server/';

const fontHeadlines = Ubuntu({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-headlines',
});

const fontBody = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

/**
 * Provider-shell for the CMS preview route (EMP-22 / EMP-24).
 *
 * The preview route lives OUTSIDE the `[site]/[locale]` route group, so the
 * production `[site]/[locale]/layout.tsx` provider stack never wraps it. The
 * EMP-15 stub supplied only `NextIntlClientProvider`, which still crashes on the
 * Storyblok happy path: mapped CMS components reach `useSessionStore` / site
 * state and there is no `<StoreProvider>` / `<SiteProvider>` above them.
 *
 * This layout replicates the production provider chain
 *   AuthSessionProvider → SiteProvider → NextIntlClientProvider → StoreProvider
 * (plus `SiteThemeStyle`, `CsrfProvider`, `SiteSessionAligner`) so any client
 * component the adapter's `CmsRenderer` tree mounts has the context it expects.
 *
 * It deliberately EXCLUDES the editor-irrelevant chrome the production layout
 * carries (plan §3 lower list):
 *  - `CmsBridgeScript` — the visual-editing bridge is owned by `page.tsx` via
 *    the active preview adapter, not the shell, which keeps this file SDK-free.
 *  - `Toaster` / `CurrencyFallbackToastBus` / `Notification` — no toast chrome
 *    inside the editor iframe.
 *  - the parallel `dialog` slot and the API debug panel.
 *
 * Unlike production it also does NOT run the invalid-site fallback redirect or
 * the site/locale-mismatch redirect: the preview URL is signed by the CMS with
 * an explicit site + locale, so an unknown site is a hard `notFound()` rather
 * than a redirect into a different tenant.
 */
export default async function PreviewLocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ site: string; locale: Locale }>;
}>) {
  const { locale, site: siteCode } = await params;

  // Reject unsupported locales before touching any SSR data source.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [site, availableSites, shopSession] = await Promise.all([
    getSite(siteCode),
    getAvailableSites(),
    getSessionForSite(siteCode),
  ]);

  // Unknown site → 404. Preview never redirects into another tenant.
  if (!site) {
    notFound();
  }

  // Mirror the production wire-up: bind the request site + locale before hydration.
  setRequestSite(siteCode);
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${fontHeadlines.variable} ${fontBody.variable} ${fontHeadlines.className} ${fontBody.className}`}
    >
      <body className="flex h-full flex-col font-body has-[.search]:overflow-hidden">
        <SiteThemeStyle siteCode={siteCode} />
        <AuthSessionProvider>
          <SiteProvider siteCode={siteCode}>
            <NextIntlClientProvider locale={locale}>
              <StoreProvider shopSession={shopSession} site={site} availableSites={availableSites}>
                <CsrfProvider />
                <SiteSessionAligner />
                {children}
              </StoreProvider>
            </NextIntlClientProvider>
          </SiteProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
