import { getSiteFallback } from '../lib/cms-settings-access';
import { fetchCMSLayout } from '../lib/fetch-cms-page';
import '../styles/cms-editor.css';
import { CMSLayout } from '../types';
import EmporixCMSProvider from './emporix-cms-provider';

type EmporixCmsLayoutCommonProps = {
  theme?: string;
  children?: React.ReactNode;
};

type EmporixCmsLayoutProps =
  | (EmporixCmsLayoutCommonProps & { layout: CMSLayout })
  | (EmporixCmsLayoutCommonProps & {
      layoutId: string;
      locale: string;
      site: string;
    });

/**
 * Server component that provides CMS layout slots (e.g. `top`, `bottom`) to
 * its children. Use in an app-router `layout.tsx` to share a persistent site
 * shell across pages while still letting each page own its `main` slot via
 * a nested `EmporixCmsPage`.
 *
 * Accepts either a pre-fetched layout:
 *   `<EmporixCmsLayout layout={layout}>…</EmporixCmsLayout>`
 * or a lookup by id + scope:
 *   `<EmporixCmsLayout layoutId="default" locale={locale} site={site}>…</EmporixCmsLayout>`
 *
 * The layout always fetches the **published** version. Editor-mode preview is
 * not driven server-side here — Next.js does not provide `searchParams` to
 * layouts, and forcing a dynamic read (via `headers()` etc.) would opt every
 * render out of caching. Instead, a nested `EmporixCmsPage` — which does
 * receive `searchParams` — fetches its bundled layout (editor-aware) and
 * hoists it up through `EmporixCMSProvider` after hydration so layout slots
 * re-render with the editor version. Live-editor postMessage updates then
 * patch the slots on top of that.
 *
 * Per-site fallback semantics mirror {@link EmporixCmsPage}: if a layout
 * is not defined on `site`, the `CMSSettingsService` is consulted for a
 * `{ site, locale }` fallback and retried before giving up.
 *
 * A missing layout is non-fatal: we render with no initial layout data and
 * let the nested page (or postMessage updates) supply slots. Calling
 * `notFound()` here would break the whole route tree even for routes whose
 * page can render perfectly fine without a preloaded layout.
 */
export default async function EmporixCmsLayout(props: EmporixCmsLayoutProps) {
  let layout: CMSLayout | undefined = undefined;

  const { theme } = props;
  if ('layout' in props) {
    layout = props.layout;
  } else {
    const { layoutId, locale, site } = props;
    const fallback = await getSiteFallback(site);
    const layoutData = await fetchCMSLayout(layoutId, locale, site, undefined, fallback ? { fallback } : undefined);

    if (!('notfound' in layoutData)) {
      layout = layoutData as CMSLayout;
    }
  }

  return (
    <EmporixCMSProvider initialLayout={layout} theme={theme}>
      {props.children}
    </EmporixCMSProvider>
  );
}
