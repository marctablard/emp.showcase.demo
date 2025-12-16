import { ReactNode } from 'react';
import { SessionProvider as AuthSessionProvider } from 'next-auth/react';
import { Locale, NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Open_Sans, Ubuntu } from 'next/font/google';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { auth } from '@/auth/auth';
import AuthDialogManager from '@/components/auth/auth-dialog-manager';
import { CsrfProvider } from '@/components/csrf/CsrfProvider';
import { Notification } from '@/components/notification/notification';
import { Toaster } from '@/components/ui/sonner';
import { redirect } from '@/i18n/edge/navigation';
import { routing } from '@/i18n/routing';
import { getSession, setSessionLanguage } from '@/lib/ssr/session';
import { getAvailableSites, getSite } from '@/lib/ssr/site';
import SiteProvider from '@/providers/SiteProvider';
import { StoreProvider } from '@/providers/StoreProvider';
import { StoryblokProvider } from '@/providers/StoryblokProvider';
import { setRequestSite } from '@/site/server/';

const defaultSiteCode = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';

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
  params: Promise<{ locale: Locale; site: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const viewport = {
  themeColor: '#192A42',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, site: defaultSiteCode }));
}

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

export default async function LocaleLayout({ children, params }: Props) {
  // Ensure that the incoming `locale` is valid
  const { locale, site: siteCode } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [authSession, shopSession] = await Promise.all([auth(), getSession()]);

  const [site, availableSites] = await Promise.all([getSite(siteCode), getAvailableSites()]);

  if (site && !hasLocale(site.languages, locale)) {
    // ensure that languages are aligned
    const newLocale = site.languages[0];
    await setSessionLanguage(newLocale);
    // force prefix to ensure that the redirect is correctly adapting the cookie
    redirect({ href: '/', locale: newLocale, site: siteCode, forcePrefix: true });
  }
  if (shopSession && shopSession.language != locale) {
    // ensure that languages are aligned
    await setSessionLanguage(locale);
    shopSession.language = locale;
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
        <AuthSessionProvider session={authSession}>
          <SiteProvider siteCode={siteCode}>
            <NextIntlClientProvider locale={locale}>
              <StoreProvider shopSession={shopSession} site={site} availableSites={availableSites}>
                <StoryblokProvider>
                  <CsrfProvider />
                  <AuthDialogManager />
                  {children}
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
