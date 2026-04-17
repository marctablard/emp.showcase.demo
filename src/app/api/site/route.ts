import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SiteService } from '@/platform/services/site/SiteService';

/**
 * GET /api/site
 * Get site data (countries, regions, currencies)
 */
export async function GET() {
  try {
    const siteService = server.get<SiteService>('SiteService');
    const site = await siteService.getSite();
    const availableSites = await siteService.getAvailableSites();

    // Return 404 if site is null
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ current: site, available: availableSites });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/site',
        method: 'GET',
      },
      'Error fetching site data',
    );
    return NextResponse.json({ error: 'Failed to fetch site data' }, { status: 500 });
  }
}
