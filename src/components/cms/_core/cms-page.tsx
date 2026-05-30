import { notFound } from 'next/navigation';
import { getCmsService } from '@/platform/services/cms/get-cms-service';
import type { CMSComponent } from '../component-schema';
import { CmsBodyFrame } from './cms-page-frame';
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
 *
 * Layout frame: after resolving the page, the shell fetches the layout for
 * `page.layoutId ?? 'default'` and, when one exists, renders the layout tree
 * with the page's own body threaded in as `pageBody` — the renderer
 * substitutes the single `content-slot` with it. When no layout resolves
 * (e.g. the `none`/`local` adapter has no layout for the id), the shell falls
 * back to rendering the page body directly, preserving prior behaviour.
 */
export default async function CmsPage({ slug, locale, site, emptyOnNoResult }: CmsPageProps) {
  const cmsService = await getCmsService();
  const page = await cmsService.getPage(slug, locale, site);

  if ('notfound' in page && page.notfound) {
    if (emptyOnNoResult) {
      return <CmsBodyFrame />;
    }
    notFound();
  }

  if (!('components' in page)) {
    notFound();
  }

  const layout = await cmsService.getLayout(page.layoutId ?? 'default', locale, site);

  if ('body' in layout) {
    // Layout present: render the frame, substituting the page body at the slot.
    return <CmsRenderer component={layout as CMSComponent} pageBody={page.components} />;
  }

  // No layout: render the page body directly (backward-compatible path).
  return (
    <CmsBodyFrame noMargin={page.no_margin}>
      {page.components.map((component) => (
        <CmsRenderer key={component.id} component={component} />
      ))}
    </CmsBodyFrame>
  );
}
