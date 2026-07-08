import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { setRequestSite } from '@/site/server';
import { getSiteFallback } from '../lib/cms-settings-access';
import { fetchCMSLayout, fetchCMSPage } from '../lib/fetch-cms-page';
import { fetchCMSTheme } from '../lib/fetch-cms-theme';
import { isValidVersion } from '../lib/version-utils';
import type { CMSLayout, CMSPage } from '../types';
import EmporixCMSProvider from './emporix-cms-provider';

type EmporixCmsPageCommonProps = {
  theme?: string;
  searchParams?: { [key: string]: string | string[] | undefined };
  children?: React.ReactNode;
};

type EmporixCmsPageProps =
  | (EmporixCmsPageCommonProps & { page: CMSPage })
  | (EmporixCmsPageCommonProps & {
      slug: string;
      locale: string;
      site: string;
      emptyOnNoResult?: boolean;
    });

/**
 * Server component that wraps CMS page content with the necessary context.
 *
 * Can be used in two ways:
 *  1. With pre-fetched page data:
 *     `<EmporixCmsPage page={page} searchParams={searchParams}>…</EmporixCmsPage>`
 *  2. With slug/locale/site:
 *     `<EmporixCmsPage slug="home" locale="en" site="main" searchParams={sp}>…</EmporixCmsPage>`
 *
 * Always fetches the page **together with its linked layout** (editor-aware,
 * driven by `searchParams`). When rendered inside an outer `EmporixCmsLayout`,
 * the nested `EmporixCMSProvider` hoists this bundled layout up to the outer
 * provider so layout-level slots (`top`/`bottom`) can swap to the editor
 * version after hydration. When rendered standalone, the bundled layout is
 * used locally for layout-level slots in the page's children.
 *
 * The component automatically detects editor mode and validates version
 * parameters from searchParams. Children should contain `EmporixContentSlot`
 * components to lay out the page body.
 *
 * Per-site fallbacks are loaded via the `CMSSettingsService` (extension-
 * owned) and applied only **outside** editor mode — editors must see the
 * "real" notFound state for the site they are editing.
 */
export default async function EmporixCmsPage(props: EmporixCmsPageProps) {
  let page: CMSPage | undefined = undefined;
  let layout: CMSLayout | undefined = undefined;
  const searchParams = props.searchParams || {};
  const isEditorMode = searchParams.editMode === 'true';
  const rawVersion = typeof searchParams.cmsVersion === 'string' ? searchParams.cmsVersion : undefined;
  const cmsVersion = isEditorMode && isValidVersion(rawVersion) ? rawVersion : undefined;
  const { cmsLocale, cmsSite, cmsLayout, cmsTheme } = searchParams;

  let effectiveLayout;
  let effectiveSite;
  let effectiveLocale;
  let fallback;
  if ('page' in props) {
    page = props.page;
    effectiveLayout = (cmsLayout as string) || page.layout?.id;
    effectiveLocale = (cmsLocale as string) || page.locale;
    effectiveSite = (cmsSite as string) || page.site;
    fallback = isEditorMode ? undefined : await getSiteFallback(effectiveSite);
  } else {
    const { slug, locale, site, emptyOnNoResult } = props;
    effectiveLayout = (cmsLayout as string) || undefined;
    effectiveLocale = (cmsLocale as string) || locale;
    effectiveSite = (cmsSite as string) || site;
    fallback = isEditorMode ? undefined : await getSiteFallback(effectiveSite);

    // Always load the linked layout too — the page response is the single
    // authoritative, editor-aware payload that seeds both page slots and
    // (via provider hoisting) any outer layout's slots.
    const pageData = await fetchCMSPage(slug, effectiveLocale, effectiveSite, cmsVersion, {
      fallback,
      loadLayout: !effectiveLayout,
      // Editor previews must bypass the live cache so a just-published change
      // is visible immediately instead of the pre-publish cached version.
      noCache: isEditorMode,
    });
    if ('notfound' in pageData) {
      if (!emptyOnNoResult) {
        return notFound();
      } else {
        page = undefined;
      }
    } else {
      page = pageData as CMSPage;
      if (!effectiveLayout) {
        effectiveLayout = page.layout?.id;
      }
    }
  }

  if (effectiveLayout) {
    const layoutData =
      effectiveLayout == page?.layout?.id
        ? page.layout
        : await fetchCMSLayout(effectiveLayout, effectiveLocale, effectiveSite, cmsVersion, {
            ...(fallback ? { fallback } : {}),
            noCache: isEditorMode,
          });
    if (!('notfound' in layoutData)) {
      layout = layoutData as CMSLayout;
    }
  }

  setRequestSite(effectiveSite);
  setRequestLocale(effectiveLocale);

  const effectiveTheme = (cmsTheme as string) || props.theme || (await fetchCMSTheme(effectiveSite))?.baseTheme;

  return (
    <EmporixCMSProvider initialPage={page} initialLayout={layout} isEditorMode={isEditorMode} theme={effectiveTheme}>
      {props.children}
    </EmporixCMSProvider>
  );
}
