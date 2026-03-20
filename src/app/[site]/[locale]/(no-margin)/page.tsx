import { setRequestLocale } from 'next-intl/server';
import EmporixCMSPage from '@/components/cms/emporix/emporix-cms-page';
import { setRequestSite } from '@/site/server/';

export default async function Home({ params }: { params: Promise<{ locale: string; site: string }> }) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  return <EmporixCMSPage slug="home" locale={locale} site={site} emptyOnNoResult={true} />;
}
