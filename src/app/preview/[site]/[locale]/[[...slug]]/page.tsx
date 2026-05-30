import { notFound } from 'next/navigation';
import { getPreviewAdapter } from '@/platform/services/cms/preview/preview-adapter-registry';

/**
 * Provider-agnostic CMS preview route (EMP-15 §6).
 *
 * Lives OUTSIDE the `[site]/[locale]` route group so the site middleware never
 * rewrites it. It dispatches solely through the preview-adapter registry — no
 * provider SDK is referenced here (drift-guarded). The reconstructed `URL`
 * only needs the query string (detection reads `searchParams` only), so the
 * origin is a stub.
 */
export const dynamic = 'force-dynamic';

interface PreviewPageParams {
  site: string;
  locale: string;
  slug?: string[];
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<PreviewPageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { site, locale, slug } = await params;
  const search = await searchParams;

  const adapter = await getPreviewAdapter();
  if (!adapter) {
    notFound();
  }

  const url = new URL('http://preview.local');
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        url.searchParams.append(key, v);
      }
    } else if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const resolvedSlug = (slug ?? []).join('/') || 'home';

  const el = await adapter.renderPreviewPage({ slug: resolvedSlug, locale, site, url });
  if (!el) {
    notFound();
  }

  return el;
}
