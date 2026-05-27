import { notFound } from 'next/navigation';
import type { CMSService } from '@/platform/services/cms/CMSService';
import ssr from '@/platform/ssr';
import { CmsRenderer } from './cms-renderer';

interface CmsPageProps {
  slug: string;
  locale: string;
  site: string;
  emptyOnNoResult?: boolean;
}

/**
 * Provider-agnostic CMS page shell.
 *
 * Fetches a page through the `CMSService` facade (which delegates to the
 * active `CmsAdapter` — local-JSON, Storyblok, or none) and renders the
 * resolved component tree via the map-driven `CmsRenderer`. No provider SDK
 * is referenced here: a CMS-provider swap is transparent to this shell.
 */
export default async function CmsPage({ slug, locale, site, emptyOnNoResult }: CmsPageProps) {
  const cmsService = ssr.get<CMSService>('CMSService');
  const page = await cmsService.getPage(slug, locale, site);

  if ('notfound' in page && page.notfound) {
    if (emptyOnNoResult) {
      return <div className="flex-grow mt-17 sm:mt-36 md:mt-52" />;
    }
    notFound();
  }

  if (!('components' in page)) {
    notFound();
  }

  return (
    <div className={page.no_margin ? '' : 'flex-grow mt-17 sm:mt-36 md:mt-52'}>
      {page.components.map((component) => (
        <CmsRenderer key={component.id} component={component} />
      ))}
    </div>
  );
}
