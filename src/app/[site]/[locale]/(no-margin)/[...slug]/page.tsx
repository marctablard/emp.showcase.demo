import { setRequestLocale } from 'next-intl/server';
import { EmporixCmsPage, EmporixContentSlot, fetchCMSPage } from '@extensions/medienwerft-cms-plugin/components';
import type { CMSPage } from '@extensions/medienwerft-cms-plugin/types';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export async function generateMetadata({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;
  const data = await fetchCMSPage(slug.join('/'), locale, site);
  if ('notFound' in data) {
    return { title: 'Page not found' };
  }
  const page = data as CMSPage;
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<DynamicPageParams>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { slug, locale, site } = await params;
  const searchParamsData = await searchParams;
  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <EmporixCmsPage slug={slug.join('/')} locale={locale} site={site} searchParams={searchParamsData}>
      <EmporixContentSlot slot="main" />
    </EmporixCmsPage>
  );
}
