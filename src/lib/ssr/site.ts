import { cache } from 'react';
import { Site } from '@/platform/services/model/common/site';
import { SiteService } from '@/platform/services/site/SiteService';
import ssr from '@/platform/ssr';

const getSiteService = () => ssr.get<SiteService>('SiteService');

const _getSite = cache(async (code: string): Promise<Site | null> => {
  try {
    const site = await getSiteService().getSite(code);
    return site || null;
  } catch (_error) {
    return null;
  }
});

const _getAvailableSites = cache(async (): Promise<Site[]> => {
  try {
    const sites = await getSiteService().getAvailableSites();
    return sites;
  } catch (_error) {
    return [];
  }
});

export function getSite(code: string): Promise<Site | null> {
  return _getSite(code);
}

export function getAvailableSites(): Promise<Site[]> {
  return _getAvailableSites();
}
