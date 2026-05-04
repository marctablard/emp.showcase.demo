import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsPage, EmporixContentSlot } from '@extensions/medienwerft-cms-plugin/components';
import { setRequestSite } from '@/site/server/';

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; site: string }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
}) {
  const { locale, site } = await params;
  const searchParamsData = await searchParams;
  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <EmporixCmsPage slug="home" locale={locale} site={site} searchParams={searchParamsData}>
      <EmporixContentSlot slot="main" />
    </EmporixCmsPage>
  );
}
