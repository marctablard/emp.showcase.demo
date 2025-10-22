import { notFound } from 'next/navigation';
import { BreadcrumbContent } from '@/lib/breadcrumb';
import { CMSService } from '@/platform/services/cms/CMSService';
import { CMSNoResult, CMSPage } from '@/platform/services/model/cms';
import ssr from '@/platform/ssr';
import { UiBreadcrumb } from '../../ui/molecules/ui-breadcrumb';
import CMSComponentRenderer from '../cms-component-renderer';

interface CMSPageParams {
  slug: string;
  locale: string;
  site?: string;
  emptyOnNoResult?: boolean;
}

/**
 * Fetch data from local CMS API
 */
async function fetchData(locale: string, slug: string, site?: string): Promise<CMSPage | CMSNoResult> {
  // Create instance of LocalCmsService directly for server component
  const cmsService = ssr.get<CMSService>('CMSService');
  return cmsService.getPage(slug, locale, site || '');
}

const buildBreadcrumb = async (slug: string, locale: string): Promise<BreadcrumbContent[]> => {
  let subSlug = slug;
  const result: BreadcrumbContent[] = [];
  while (subSlug.length > 0) {
    const pageData = (await fetchData(locale, subSlug)) as CMSPage;
    if (!('notfound' in pageData)) {
      result.push({
        href: `/${subSlug}`,
        label: pageData.title,
      });
    }
    const ix = subSlug.lastIndexOf('/');
    if (ix === -1) {
      break;
    }
    subSlug = subSlug.substring(0, ix);
  }
  return result;
};

/**
 * CMS Page Component
 * Fetches and displays content from local CMS using server components
 */
export default async function CMSPageComponent({ slug, locale, site, emptyOnNoResult }: CMSPageParams) {
  const pageData = await fetchData(locale, slug, site);

  // Handle not found
  if ('notfound' in pageData) {
    if (emptyOnNoResult) {
      return (
        <>
          <div className="flex-grow mt-17 md:mt-36 lg:mt-52"></div>
        </>
      );
    }
    notFound();
  }

  // Cast to CMSPage since we've checked it's not a CMSNoResult
  const page = pageData as CMSPage;

  // Build breadcrumb
  let breadcrumb: BreadcrumbContent[] = [];
  if (!page.no_margin) {
    breadcrumb = await buildBreadcrumb(slug, locale);
  }

  return (
    <>
      <div className="flex-grow mt-17 md:mt-36 lg:mt-52">
        {breadcrumb.length > 0 && (
          <UiBreadcrumb items={breadcrumb} className="max-w-6xl mx-auto px-4 lg:px-9 md:gap-x-6" />
        )}
        <CMSComponentRenderer components={page.components} locale={locale} />
      </div>
    </>
  );
}
