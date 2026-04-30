import { cache } from 'react';
import type { PageType } from '@/platform/services/contentpages/ContentPageResolver';
import { ContentPageResolver } from '@/platform/services/contentpages/ContentPageResolver';
import type { ContentPagesService } from '@/platform/services/contentpages/ContentPagesService';
import ssr from '@/platform/ssr';

/**
 * Get the CONTENTPAGE id based on a URL pathname.
 * Maps pathnames to page types: home, product, category, search.
 * Cached per request via React's cache().
 */
export const getCurrentContentPageId = cache(async (pathname = '/'): Promise<string | null> => {
  const contentPagesService = ssr.get<ContentPagesService>('ContentPagesService');
  return ContentPageResolver.getContentPageIdFromPathname(pathname, contentPagesService);
});

/**
 * Get the CONTENTPAGE id for an explicit page type.
 * Cached per request via React's cache().
 */
export const getContentPageIdByPageType = cache(async (pageType: PageType): Promise<string | null> => {
  const contentPagesService = ssr.get<ContentPagesService>('ContentPagesService');
  return ContentPageResolver.getContentPageIdByPageType(pageType, contentPagesService);
});
