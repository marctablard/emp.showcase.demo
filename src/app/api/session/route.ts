import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * GET /api/session
 * Get current session data
 */
export async function GET() {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    return NextResponse.json(session);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session',
        method: 'GET',
      },
      'Error fetching session data',
    );
    return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
  }
}

/**
 * PATCH /api/session
 * Update session data
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    // Handle each possible update field
    if (data.language !== undefined) {
      await sessionService.setLanguage(data.language);
    }

    if (data.currency !== undefined) {
      await sessionService.setCurrency(data.currency);
    }

    if (data.country !== undefined) {
      await sessionService.setCountry(data.country);
    }

    if (data.site !== undefined) {
      await sessionService.setSite(data.site);
    }

    // Return the updated session
    const updatedSession = await sessionService.getCurrent();
    return NextResponse.json(updatedSession);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session',
        method: 'PATCH',
      },
      'Error updating session data',
    );
    return NextResponse.json({ error: 'Failed to update session data' }, { status: 500 });
  }
}
