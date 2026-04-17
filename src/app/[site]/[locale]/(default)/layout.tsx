import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import Footer from '@/components/footer';
import { FooterLinks, FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { Header } from '@/components/header/header';
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
    <>
      <Header />
      <main className="flex-grow mt-17 sm:mt-36 md:mt-52">{children}</main>
      <footer>
        <FooterWrapper>
          <FooterLinks />
          <Footer />
        </FooterWrapper>
        <LegalFooter />
      </footer>
    </>
  );
}
