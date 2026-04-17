import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * PUT /api/session/language
 * Update session language
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    if (!data.language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }

    await sessionService.setLanguage(data.language);

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session/language',
        method: 'PUT',
      },
      'Error updating session language',
    );
    return NextResponse.json({ error: 'Failed to update session language' }, { status: 500 });
  }
}
