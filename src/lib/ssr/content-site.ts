import { cache } from 'react';
import { ContentSiteResolver } from '@/platform/services/contentsites/ContentSiteResolver';
import type { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';
import type { SessionService } from '@/platform/services/session/SessionService';
import ssr from '@/platform/ssr';

/**
 * Get the current CONTENTSITE entity id from the request context.
 *
 * Resolves the active site code (route [site] segment → session → env default),
 * then translates it to the CONTENTSITE entity id (name.en === siteCode lookup).
 * Cached per request via React's cache().
 */
export const getCurrentContentSiteId = cache(async (): Promise<string | null> => {
  const sessionService = ssr.get<SessionService>('SessionService');
  const contentSitesService = ssr.get<ContentSitesService>('ContentSitesService');
  return ContentSiteResolver.getCurrentContentSiteId(sessionService, contentSitesService);
});

/**
 * Get the CONTENTSITE entity id for a specific site code.
 * Cached per request via React's cache().
 */
export const getContentSiteIdBySiteCode = cache(async (siteCode: string): Promise<string | null> => {
  const contentSitesService = ssr.get<ContentSitesService>('ContentSitesService');
  return ContentSiteResolver.getContentSiteIdBySiteCode(siteCode, contentSitesService);
});
