import type { NextRequest } from 'next/server';
import { isPersonalised, jsonResponse } from '@/app/api/_util/personalised-json-response';
import { getSuggestionsWithSearchFallback } from '@/app/api/_util/suggestions-with-search-fallback';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import {
  MAX_PREVIEW_PRODUCTS,
  type SearchPreview,
  mergePreviewSuggestions,
  previewTerms,
  stripProductHighlights,
} from '@/lib/search/search-preview';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductsModeContext, ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type { SearchService } from '@/platform/services/search/SearchService';

const MAX_TERM_LENGTH = 100;

/**
 * Zero-query search preview shown when the header search is opened before typing.
 * GET /api/search/preview?term=newest&term=older&locale=en&site=main&currency=EUR
 *
 * Each `term` (the shopper's past searches, newest first) runs through the engine's suggest, so its
 * ranking rules (Battery Included boosts, pins, synonyms) pick the products and query completions.
 * Without history — or when no past search matches anymore — the engine's empty-query ranking is used.
 * Products-mode scoping and caching follow `/api/search/suggestions`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const terms = previewTerms(
    url.searchParams
      .getAll('term')
      .map((term) => term.slice(0, MAX_TERM_LENGTH))
      .reverse(),
  );
  const locale = url.searchParams.get('locale') || undefined;
  const site = url.searchParams.get('site') || undefined;
  const currency = url.searchParams.get('currency') || undefined;
  let ctx: ProductsModeContext | undefined;

  try {
    const searchService = server.get<SearchService>('SearchService');
    ctx = await server.get<ProductsModeService>('ProductsModeService').resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: site,
    });
    const assigned = ctx.mode === 'assigned';
    const baseParams = {
      locale,
      site: isPersonalised(ctx) ? (ctx.siteCode ?? site) : site,
      currency,
      ...(assigned ? { segmentIds: ctx.segmentIds } : {}),
    };

    const settled = await Promise.allSettled(
      terms.map((query) => getSuggestionsWithSearchFallback(searchService, { ...baseParams, query })),
    );
    const results = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    let preview: SearchPreview = mergePreviewSuggestions(terms, results);

    if (preview.products.length === 0) {
      const popular = await searchService.getSuggestions({ ...baseParams, query: '' });
      preview = {
        source: 'popular',
        products: (popular.products ?? []).slice(0, MAX_PREVIEW_PRODUCTS).map(stripProductHighlights),
        queryCompletions: preview.queryCompletions,
      };
    }

    return jsonResponse(preview, isPersonalised(ctx));
  } catch (error) {
    server.get<LoggerService>('LoggerService').error(
      {
        error: error instanceof Error ? error.message : String(error),
        path: '/api/search/preview',
        method: 'GET',
        terms: terms.length,
        locale,
        site,
        mode: ctx?.mode,
      },
      'Error fetching search preview',
    );
    return jsonResponse({ error: 'Failed to fetch search preview' }, ctx === undefined || isPersonalised(ctx), 500);
  }
}
