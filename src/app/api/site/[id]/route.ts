import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SiteService } from '@/platform/services/site/SiteService';

/**
 * GET /api/site/{id}
 * Get site data (countries, regions, currencies)
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const siteService = server.get<SiteService>('SiteService');
    const { id } = await params;
    const site = await siteService.getSite(id);

    // Return 404 if site is null
    if (!site) {
      return NextResponse.json({ error: `Site with id '${id}' not found` }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const { id } = await params;
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/site/${id}`,
        method: 'GET',
        siteId: id,
      },
      'Error fetching site data',
    );
    return NextResponse.json({ error: 'Failed to fetch site data' }, { status: 500 });
  }
}
