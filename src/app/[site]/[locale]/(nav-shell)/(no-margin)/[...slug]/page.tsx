import { setRequestLocale } from 'next-intl/server';
import CmsPage from '@/components/cms/_core/cms-page';
import { getCmsService } from '@/platform/services/cms/get-cms-service';
import { setRequestSite } from '@/site/server';

interface DynamicPageParams {
  slug: string[];
  locale: string;
  site: string;
}

export async function generateMetadata({ params }: { params: Promise<DynamicPageParams> }) {
  const { slug, locale, site } = await params;
  const cmsService = await getCmsService();
  const page = await cmsService.getPage(slug.join('/'), locale, site);
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
