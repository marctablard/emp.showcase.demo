import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { SessionService } from '@/platform/services/session/SessionService';
import { SiteService } from '@/platform/services/site/SiteService';

/**
 * PUT /api/session/site
 * Update session site
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const siteService = server.get<SiteService>('SiteService');
    const data = await request.json();

    if (!data.site) {
      return NextResponse.json({ error: 'Site is required' }, { status: 400 });
    }
    const newSite = await siteService.getSite(data.site);
    if (!newSite) {
      return NextResponse.json({ error: 'Unknown Site' }, { status: 400 });
    }
    await sessionService.setSite(newSite.code, newSite.defaultCurrency.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isVersionConflictError =
      errorMessage.includes('Failed to update own session context: Not Found') &&
      errorMessage.includes('version') &&
      errorMessage.includes('has not been found');

    logger.error(
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: isVersionConflictError ? 'SESSION_CONTEXT_VERSION_CONFLICT' : 'UNKNOWN',
        path: '/api/session/site',
        method: 'PUT',
      },
      'Error updating session site',
    );
    if (isVersionConflictError) {
      return NextResponse.json(
        {
          error: 'Failed to update session site',
          code: 'SESSION_CONTEXT_VERSION_CONFLICT',
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to update session site', code: 'SESSION_SITE_UPDATE_FAILED' },
      { status: 500 },
    );
  }
}
