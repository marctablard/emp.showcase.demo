import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/region
 * Update session region
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const data = await request.json();

    if (!data.region) {
      return NextResponse.json({ error: 'Region is required' }, { status: 400 });
    }

    await sessionService.setRegion(data.region);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session region:', error);
    return NextResponse.json({ error: 'Failed to update session region' }, { status: 500 });
  }
}
