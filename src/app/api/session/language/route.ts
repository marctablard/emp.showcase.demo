import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';

export const dynamic = 'force-dynamic';

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
    console.error('Error updating session language:', error);
    return NextResponse.json({ error: 'Failed to update session language' }, { status: 500 });
  }
}
