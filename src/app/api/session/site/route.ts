import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';
import { SiteService } from '@/platform/services/site/SiteService';

export const dynamic = 'force-dynamic';

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
    await sessionService.setSite(newSite.code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session site:', error);
    return NextResponse.json({ error: 'Failed to update session site' }, { status: 500 });
  }
}
