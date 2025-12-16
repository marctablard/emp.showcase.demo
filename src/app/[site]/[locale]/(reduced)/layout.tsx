import { ReactNode } from 'react';
import Footer, { FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { HeaderCheckout } from '@/components/header/header-checkout';

type Props = {
  children: ReactNode;
};

export default async function LocaleLayout({ children }: Props) {
  return (
    <>
      <HeaderCheckout />
      <main className="flex-grow mt-28">{children}</main>
      <footer>
        <FooterWrapper>
          <Footer reduced />
        </FooterWrapper>
        <LegalFooter />
      </footer>
    </>
  );
}
