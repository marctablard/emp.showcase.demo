import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/company
 * Update session company (legal entity)
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    if (!data.legalEntityId) {
      return NextResponse.json({ error: 'Legal entity ID is required' }, { status: 400 });
    }

    await sessionService.setLegalEntity(data.legalEntityId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session/company',
        method: 'PUT',
      },
      'Error updating session company',
    );
    return NextResponse.json({ error: 'Failed to update session company' }, { status: 500 });
  }
}
