import { NextRequest, NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import server from '@/platform/server';
import { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';
import { SessionService } from '@/platform/services/session/SessionService';
import { INTERNAL_SITE_HEADER } from '@/site/types';

/**
 * GET /api/contentsites/logo
 * Returns the logo media URL for the current site's CONTENTSITE entity.
 *
 * CONTENTSITE id === siteCode, so we fetch the entity by id directly.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const contentSitesService = server.get<ContentSitesService>('ContentSitesService');
    const apiInvoker = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get<EmporixConfig>('EmporixConfig');

    const { searchParams } = new URL(request.url);
    const siteCodeFromQuery = searchParams.get('siteCode');

    // Site resolution priority: query param → internal header → referer URL → session → env default
    const siteFromHeader = request.headers.get(INTERNAL_SITE_HEADER);
    const session = await sessionService.getCurrent();

    let siteFromReferer: string | null = null;
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const segments = new URL(referer).pathname.split('/').filter(Boolean);
        if (segments.length > 0) siteFromReferer = segments[0];
      } catch {
        // ignore
      }
    }

    const siteCode =
      siteCodeFromQuery ||
      siteFromHeader ||
      siteFromReferer ||
      session?.siteCode ||
      process.env.NEXT_PUBLIC_DEFAULT_SITE ||
      'main';

    if (!siteCode) {
      return NextResponse.json({ logoUrl: null, siteCode: null });
    }

    // CONTENTSITE id === siteCode — fetch directly by id
    const contentSite = await contentSitesService.getContentSite(siteCode);

    if (!contentSite || !contentSite.media?.length) {
      return NextResponse.json({ logoUrl: null, siteCode });
    }

    // Fetch the asset URL from the Emporix Media API
    const mediaId = contentSite.media[0];
    const mediaResponse = await apiInvoker.authenticatedFetch(
      `/media/${config.tenant}/assets/${mediaId}`,
      { method: 'GET' },
      'service',
    );

    if (!mediaResponse.ok) {
      return NextResponse.json({ logoUrl: null, siteCode });
    }

    const mediaAsset = await mediaResponse.json();
    return NextResponse.json({ logoUrl: mediaAsset.url || null, siteCode });
  } catch (error) {
    console.error('Error fetching content site logo:', error);
    return NextResponse.json({ error: 'Failed to fetch logo' }, { status: 500 });
  }
}
