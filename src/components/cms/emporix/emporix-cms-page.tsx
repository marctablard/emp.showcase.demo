import { cache } from 'react';
import { notFound } from 'next/navigation';
import { BreadcrumbContent } from '@/lib/breadcrumb';
import { CMSService } from '@/platform/services/cms/CMSService';
import { ContentItem } from '@/platform/services/contentitems/ContentItemsService';
import { CMSPage } from '@/platform/services/model/cms';
import ssr from '@/platform/ssr';
import { UiBreadcrumb } from '../../ui/molecules/ui-breadcrumb';
import { renderContentItems } from './content-item-renderer';

interface EmporixCMSPageProps {
  slug: string;
  locale: string;
  site?: string;
  emptyOnNoResult?: boolean;
}

const fetchData = cache(async (slug: string, locale: string, site?: string) => {
  const cmsService = ssr.get<CMSService>('CMSService');
  return cmsService.getPage(slug, locale, site || '');
});

const buildBreadcrumb = async (slug: string, locale: string, site?: string): Promise<BreadcrumbContent[]> => {
  let subSlug = slug;
  const result: BreadcrumbContent[] = [];
  while (subSlug.length > 0) {
    const pageData = (await fetchData(subSlug, locale, site)) as CMSPage;
    if (!('notfound' in pageData)) {
      result.push({ href: `/${subSlug}`, label: pageData.title });
    }
    const ix = subSlug.lastIndexOf('/');
    if (ix === -1) break;
    subSlug = subSlug.substring(0, ix);
  }
  return result;
};

/**
 * Emporix CMS Page component — fetches and renders ContentItems from Emporix custom entities.
 */
export default async function EmporixCMSPage({ slug, locale, site, emptyOnNoResult }: EmporixCMSPageProps) {
  const pageData = await fetchData(slug, locale, site);
  const pathname = slug ? `/${slug}` : '/';

  if ('notfound' in pageData) {
    if (emptyOnNoResult) {
      return <div className="flex-grow mt-17 sm:mt-36 md:mt-52" />;
    }
    return notFound();
  }

  const page = pageData as CMSPage;

  let breadcrumb: BreadcrumbContent[] = [];
  if (!page.no_margin) {
    breadcrumb = await buildBreadcrumb(slug, locale, site);
  }

  // Extract ContentItems attached by EmporixCMSService
  const contentItems = page.components
    .filter((component) => (component as any).contentItem)
    .map((component) => (component as any).contentItem as ContentItem);

  const isHomepage = pathname === '/' || slug === '' || slug === 'home';
  const contentItemComponents = await renderContentItems(contentItems, isHomepage);

  return (
    <div className={page.no_margin ? '' : 'flex-grow mt-17 sm:mt-36 md:mt-52'}>
      {breadcrumb.length > 0 && (
        <UiBreadcrumb items={breadcrumb} className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6" />
      )}
      {contentItemComponents}
    </div>
  );
}
