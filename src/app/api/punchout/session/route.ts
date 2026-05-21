import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PunchoutService } from '@/platform/services/punchout/PunchoutService';

/**
 * GET /api/punchout/session
 * Returns the configured PUNCHOUT_SESSIONS custom entity (form post URL, buyer cookie, DUNS, etc.).
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const punchoutService = server.get<PunchoutService>('PunchoutService');
    const session = await punchoutService.getPunchoutSession();

    if (!session) {
      return NextResponse.json({ error: 'Punchout session not configured or not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/punchout/session',
        method: 'GET',
      },
      'Error fetching punchout session',
    );
    return NextResponse.json({ error: 'Failed to fetch punchout session' }, { status: 500 });
  }
}
