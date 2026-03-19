import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { Site } from '@/platform/services/model/common/site';
import { SiteService } from '@/platform/services/site/SiteService';
import ssr from '@/platform/ssr';

const getSiteService = () => ssr.get<SiteService>('SiteService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

const _getSite = cache(async (code: string): Promise<Site | null> => {
  try {
    const site = await getSiteService().getSite(code);
    return site || null;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), siteCode: code },
      'SSR getSite failed',
    );
    return null;
  }
});

const _getAvailableSites = cache(async (): Promise<Site[]> => {
  try {
    const sites = await getSiteService().getAvailableSites();
    return sites;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error) },
      'SSR getAvailableSites failed',
    );
    return [];
  }
});

export function getSite(code: string): Promise<Site | null> {
  return _getSite(code);
}

export function getAvailableSites(): Promise<Site[]> {
  return _getAvailableSites();
}
