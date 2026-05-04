import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsLayout, EmporixContentSlot } from '@extensions/medienwerft-cms-plugin/components';
import Footer from '@/components/footer';
import { FooterLinks, FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { Header } from '@/components/header/header';
import { setRequestSite } from '@/site/server/';

type Props = {
  params: Promise<{ locale: string; site: string }>;
  children: ReactNode;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <EmporixCmsLayout layoutId="default" locale={locale} site={site}>
      <header>
        <EmporixContentSlot slot="top" />
      </header>
      <main>{children}</main>
      <footer>
        <EmporixContentSlot slot="bottom" />
      </footer>
    </EmporixCmsLayout>
  );
}
