import type { ReactNode } from 'react';
import { type Locale, NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { routing } from '@/i18n/routing';

/**
 * Provider-shell for the preview route (EMP-15 Phase F).
 *
 * The route lives outside the `[site]/[locale]` group, so its main layout's
 * `NextIntlClientProvider` + `setRequestLocale(locale)` initialization does not
 * apply. Without that, any rendered `'use client'` component that calls
 * `useLocale()` (`SiteLink`, `useTranslations`, ...) blows up with a runtime
 * error in RSC — the page returns 500 instead of either 200 (valid preview) or
 * 404 (rejection). This layout supplies the minimal locale context the adapter's
 * mapped `CmsRenderer` tree expects, mirroring the wire-up the production
 * `[site]/[locale]/layout.tsx` does on lines 141 + 157.
 */
export default async function PreviewLocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ site: string; locale: Locale }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <NextIntlClientProvider locale={locale}>{children}</NextIntlClientProvider>;
}
