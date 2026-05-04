import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsLayout, EmporixContentSlot } from '@extensions/medienwerft-cms-plugin/components';
import Footer, { FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { HeaderCheckout } from '@/components/header/header-checkout';
import { setRequestSite } from '@/site/server/';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; site: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <EmporixCmsLayout layoutId="reduced" locale={locale} site={site}>
      <EmporixContentSlot slot="top" />
      <main className="flex-grow mt-28">{children}</main>
      <EmporixContentSlot slot="bottom" />
    </EmporixCmsLayout>
  );
}
