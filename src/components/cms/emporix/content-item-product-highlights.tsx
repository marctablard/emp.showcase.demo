import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { getCurrentContentSiteId } from '@/lib/ssr/content-site';
import { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';
import ssr from '@/platform/ssr';
import { RecommendationsWrapper } from './content-item-product-highlights-wrapper';

/**
 * Fetch the current CONTENTSITE and extract product highlight IDs
 */
const fetchContentSiteProductHighlights = cache(async (): Promise<{ productIds: string[] | null }> => {
  try {
    const contentSiteId = await getCurrentContentSiteId();
    if (!contentSiteId) {
      return { productIds: null };
    }

    const contentSitesService = ssr.get<ContentSitesService>('ContentSitesService');
    const contentSite = await contentSitesService.getContentSite(contentSiteId);

    if (!contentSite) {
      return { productIds: null };
    }

    const productHighlights = contentSite.mixins?.producthighlights?.products;
    if (!productHighlights || productHighlights.length === 0) {
      return { productIds: null };
    }

    const productIds = productHighlights
      .map((product) => product?.id?.trim())
      .filter((id): id is string => Boolean(id) && typeof id === 'string' && id.length > 0);

    return { productIds: productIds.length > 0 ? productIds : null };
  } catch {
    return { productIds: null };
  }
});

/**
 * Fetches product IDs from the current CONTENTSITE's producthighlights mixin
 * and displays them using the Recommendations component.
 */
export default async function ContentItemProductHighlights() {
  let productIds: string[] | null = null;
  let locale = '';

  try {
    const result = await fetchContentSiteProductHighlights();
    productIds = result.productIds;

    if (!productIds || productIds.length === 0) {
      return null;
    }

    locale = await getLocale();
  } catch {
    return null;
  }

  const productsString = productIds.join(', ');

  return <RecommendationsWrapper products={productsString} locale={locale} />;
}
