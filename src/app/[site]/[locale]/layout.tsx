import type { ReactNode } from 'react';
import { SessionProvider as AuthSessionProvider } from 'next-auth/react';
import type { Locale } from 'next-intl';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Open_Sans, Ubuntu } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { CsrfProvider } from '@/components/csrf/CsrfProvider';
import { ApiDebugPanel } from '@/components/debug/ApiDebugPanel';
import { Notification } from '@/components/notification/notification';
import { Toaster } from '@/components/ui/sonner';
import { redirect } from '@/i18n/edge/navigation';
import { routing } from '@/i18n/routing';
import { isBrowserDebugOutputEnabled, isDebugApiEnabled } from '@/lib/common/debug-env';
import { getSessionForSite, setSessionLanguage } from '@/lib/ssr/session';
import { getAvailableSites, getSite } from '@/lib/ssr/site';
import SiteProvider from '@/providers/SiteProvider';
import { SiteSessionAligner } from '@/providers/SiteSessionAligner';
import { StoreProvider } from '@/providers/StoreProvider';
import { StoryblokProvider } from '@/providers/StoryblokProvider';
import { setRequestSite } from '@/site/server/';
import { INTERNAL_APP_PATH_HEADER } from '@/site/types';

const defaultSiteCode = process.env.NEXT_PUBLIC_DEFAULT_SITE || undefined;

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

type Props = {
  children: ReactNode;
  dialog: ReactNode;
  params: Promise<{ locale: Locale; site: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
};

/**
 * Strip a leading locale segment from the site-relative app path the middleware stored in
 * `INTERNAL_APP_PATH_HEADER`. Used when the URL-derived locale is not supported by the current
 * site so we can redirect to the same deep link under a supported locale.
 */
function stripLocalePrefix(appPath: string, locale: string): string {
  if (!appPath || !locale) {
    return appPath;
  }
  if (appPath === locale) {
    return '';
  }
  if (appPath.startsWith(`${locale}/`)) {
    return appPath.slice(locale.length + 1);
  }
  return appPath;
}

export const viewport = {
  themeColor: '#192A42',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(props: Omit<Props, 'children'>) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'seo' });

  return {
    title: t('storeName'),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: t('storeName'),
    },
  };
}

export default async function LocaleLayout({ children, dialog, params }: Props) {
  // Ensure that the incoming `locale` is valid
  const { locale, site: siteCode } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Align the Emporix session's siteCode with the URL-derived site BEFORE hydration.
  // Prevents the "stale siteCode" deep-link race where the server session still points
  // at the previous site (e.g. `main`) while the URL and `siteStore` already reflect
  // the target site (e.g. `us-branch`), causing `SiteSessionAligner` to tear down the
  // correct `siteStore` state on mount. See `_alignSessionSite` for the full rationale.
  const [site, availableSites, shopSession] = await Promise.all([
    getSite(siteCode),
    getAvailableSites(),
    getSessionForSite(siteCode),
  ]);

  // Handle invalid site: redirect to valid site (fallback ON) or show 404 (fallback OFF)
  if (!site) {
    const fallbackEnabled = !!defaultSiteCode;
    if (fallbackEnabled && availableSites && availableSites.length > 0) {
      const targetSite = availableSites[0];
      const targetLocale = targetSite.languages?.includes(locale) ? locale : targetSite.languages?.[0] || locale;
      redirect({ href: '/', locale: targetLocale, site: targetSite.code, forcePrefix: true });
      return;
    } else {
      // No sites available, show 404
      notFound();
    }
  }

  if (site && !hasLocale(site.languages, locale)) {
    // Pick the first locale advertised by the target site as the replacement. Align the Emporix
    // session with that supported locale (the previous value would have been the unsupported one,
    // which the downstream price/content services cannot render).
    const newLocale = site.languages[0];
    setSessionLanguage(newLocale);

    // Preserve the deep link the user is trying to reach. Before this fix the redirect always
    // landed on `/`, so clicking a stale `/us/de/product/<id>` link (produced by a header search
    // rendered mid-site-switch) redirected to the US home page instead of the product.
    const requestHeaders = await headers();
    const appPath = requestHeaders.get(INTERNAL_APP_PATH_HEADER) ?? '';
    const pathWithoutLocale = stripLocalePrefix(appPath, locale);
    const targetHref = pathWithoutLocale ? `/${pathWithoutLocale}` : '/';

    return redirect({ href: targetHref, locale: newLocale, site: siteCode, forcePrefix: true });
  }
  // TODO: we need to figure out why getRequestSite
  // doesn't return the correct value in child layouts
  // (we need to duplicate this call there)
  setRequestSite(siteCode);
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${fontHeadlines.variable} ${fontBody.variable} ${fontHeadlines.className} ${fontBody.className}`}
    >
      <body className="flex h-full flex-col font-body has-[.search]:overflow-hidden">
        <AuthSessionProvider>
          <SiteProvider siteCode={siteCode}>
            <NextIntlClientProvider locale={locale}>
              <StoreProvider shopSession={shopSession} site={site} availableSites={availableSites}>
                <StoryblokProvider>
                  <CsrfProvider />
                  <SiteSessionAligner />
                  {isDebugApiEnabled() && isBrowserDebugOutputEnabled() && <ApiDebugPanel />}
                  {children}
                  {dialog}
                  <Toaster />
                  <Notification />
                </StoryblokProvider>
              </StoreProvider>
            </NextIntlClientProvider>
          </SiteProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
