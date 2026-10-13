'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import useHistory from '@/hooks/history/useHistory';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { buildClientFetchScope } from '@/lib/client/client-fetch-scope';
import { getLogger } from '@/lib/logger/use-logger-client';
import { EMPTY_SEARCH_PREVIEW, type SearchPreview, previewTerms } from '@/lib/search/search-preview';
import { useSessionStore } from '@/providers/StoreProvider';

export interface UseSearchPreviewResult {
  preview: SearchPreview;
  loading: boolean;
}

/**
 * Keyed by `[products mode, site, customer, currency, locale, terms]`: the header fly-out unmounts on
 * every close, so re-opening it in the same scope must not refetch the preview.
 */
const previewCache = new Map<string, Promise<SearchPreview>>();

export function clearSearchPreviewCache(): void {
  previewCache.clear();
}

async function fetchPreview(terms: string[], site: string, locale: string, currency?: string): Promise<SearchPreview> {
  const url = new URL('/api/search/preview', window.location.origin);
  terms.forEach((term) => url.searchParams.append('term', term));
  url.searchParams.append('site', site);
  url.searchParams.append('locale', locale);
  if (currency) {
    url.searchParams.append('currency', currency);
  }
  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Search preview failed: ${response.status}`);
  }
  return (await response.json()) as SearchPreview;
}

interface PreviewResult {
  key: string;
  preview: SearchPreview;
}

/** Zero-query preview (products + query completions) for the header search, based on past searches. */
export function useSearchPreview(enabled: boolean): UseSearchPreviewResult {
  const { searchHistory } = useHistory();
  const siteCode = useSiteCode()?.trim();
  const locale = useLocale();
  const session = useSessionStore().session;
  const { mode } = useProductsMode();
  const terms = useMemo(() => previewTerms(searchHistory), [searchHistory]);
  const scope = buildClientFetchScope({ mode, siteCode, customerId: session?.customerId, extra: session?.currency });
  const key = `${scope}:${locale}:${JSON.stringify(terms)}`;
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!enabled || !siteCode) return;
    let cancelled = false;
    let request = previewCache.get(key);
    if (!request) {
      request = fetchPreview(terms, siteCode, locale, session?.currency);
      previewCache.set(key, request);
      request.catch(() => previewCache.delete(key));
    }
    request
      .then((preview) => {
        if (!cancelled) setResult({ key, preview });
      })
      .catch((err: unknown) => {
        getLogger().error({ err }, 'Error fetching search preview');
        if (!cancelled) setResult({ key, preview: EMPTY_SEARCH_PREVIEW });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, terms, siteCode, locale, session?.currency]);

  const current = result?.key === key ? result.preview : undefined;
  return { preview: current ?? EMPTY_SEARCH_PREVIEW, loading: enabled && Boolean(siteCode) && !current };
}

export default useSearchPreview;
