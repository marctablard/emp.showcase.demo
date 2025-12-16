import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/currency
 * Update session currency
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    if (!data.currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    await sessionService.setCurrency(data.currency);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session currency:', error);
    return NextResponse.json({ error: 'Failed to update session currency' }, { status: 500 });
  }
}
