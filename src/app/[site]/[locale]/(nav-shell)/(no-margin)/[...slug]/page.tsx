import { setRequestLocale } from 'next-intl/server';
import CMSPageComponent, { fetchData } from '@/components/cms/storyblok/storyblok-cms-page';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export async function generateMetadata({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;
  const data = await fetchData(locale, slug.join('/'), site);
  return {
    title: data?.data?.story?.name,
  };
}

export default async function DynamicPage({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;

  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <div>
      <CMSPageComponent slug={slug.join('/')} locale={locale} site={site} />
    </div>
  );
}
