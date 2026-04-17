import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CMSService } from '@/platform/services/cms/CMSService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import ssr from '@/platform/ssr';

/**
 * GET /api/cms
 * Get CMS page data based on slug, locale, and site
 */
export async function GET(request: NextRequest) {
  // Get query parameters (outside try for logging context)
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'home';
  const locale = searchParams.get('locale') || 'de';
  const site = searchParams.get('site') || '';

  try {
    // Create CMS service instance
    const cmsService = ssr.get<CMSService>('CMSService');

    // Get page data
    const pageData = await cmsService.getPage(slug, locale, site);

    // Return response
    return NextResponse.json(pageData);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cms',
        method: 'GET',
        slug,
        locale,
        site,
      },
      'Error fetching CMS data',
    );
    return NextResponse.json({ error: 'Failed to fetch CMS data' }, { status: 500 });
  }
}
