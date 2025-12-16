import { setRequestLocale } from 'next-intl/server';
import CMSPageComponent from '@/components/cms/storyblok/storyblok-cms-page';
import { setRequestSite } from '@/site/server/';

export default async function Home({ params }: { params: Promise<{ locale: string; site: string }> }) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  return <CMSPageComponent slug="home" locale={locale} site={site} emptyOnNoResult={true} />;
}
