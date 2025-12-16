import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/country
 * Update session country
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    if (!data.country) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }

    await sessionService.setCountry(data.country);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session country:', error);
    return NextResponse.json({ error: 'Failed to update session country' }, { status: 500 });
  }
}
