import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsPage, EmporixContentSlot, fetchCMSPage } from '@extensions/medienwerft-cms-plugin/components';
import type { CMSPage } from '@extensions/medienwerft-cms-plugin/types';
import { setRequestSite } from '@/site/server/';

const HOME_SLUG = 'home';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; site: string }> }) {
  const { locale, site } = await params;
  const data = await fetchCMSPage(HOME_SLUG, locale, site);
  if ('notfound' in data) {
    return { title: 'Page not found' };
  }
  const page = data as CMSPage;
  return {
    title: page.title,
    description: page.description,
  };
}

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
    <EmporixCmsPage slug={HOME_SLUG} locale={locale} site={site} searchParams={searchParamsData}>
      <EmporixContentSlot slot="main" />
    </EmporixCmsPage>
  );
}
