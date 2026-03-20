import { setRequestLocale } from 'next-intl/server';
import EmporixCMSPage from '@/components/cms/emporix/emporix-cms-page';
import CMSPageComponent from '@/components/cms/storyblok/storyblok-cms-page';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export default async function DynamicPage({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;

  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <>
      <EmporixCMSPage slug={slug.join('/')} locale={locale} site={site} emptyOnNoResult={true} />
      <CMSPageComponent slug={slug.join('/')} locale={locale} site={site} emptyOnNoResult={true} />
    </>
  );
}
