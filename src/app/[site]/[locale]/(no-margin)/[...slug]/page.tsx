import { setRequestLocale } from 'next-intl/server';
import CmsPage from '@/components/cms/_core/cms-page';
import type { CMSService } from '@/platform/services/cms/CMSService';
import ssr from '@/platform/ssr';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export async function generateMetadata({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;
  const page = await ssr.get<CMSService>('CMSService').getPage(slug.join('/'), locale, site);
  return {
    title: 'title' in page ? page.title : undefined,
  };
}

export default async function DynamicPage({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;

  setRequestSite(site);
  setRequestLocale(locale);
  return (
    <div>
      <CmsPage slug={slug.join('/')} locale={locale} site={site} />
    </div>
  );
}
