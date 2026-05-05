import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsLayout, EmporixContentSlot } from '@extensions/medienwerft-cms-plugin/components';
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
    <EmporixCmsLayout layoutId="default" locale={locale} site={site}>
      <header>
        <EmporixContentSlot slot="top" />
      </header>
      <main className="flex-grow mt-28">{children}</main>
      <footer>
        <EmporixContentSlot slot="bottom" />
      </footer>
    </EmporixCmsLayout>
  );
}
