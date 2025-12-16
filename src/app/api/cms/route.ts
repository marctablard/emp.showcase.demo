import { NextRequest, NextResponse } from 'next/server';
import { CMSService } from '@/platform/services/cms/CMSService';
import ssr from '@/platform/ssr';

/**
 * GET /api/cms
 * Get CMS page data based on slug, locale, and site
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'home';
    const locale = searchParams.get('locale') || 'de';
    const site = searchParams.get('site') || '';

    // Create CMS service instance
    const cmsService = ssr.get<CMSService>('CMSService');

    // Get page data
    const pageData = await cmsService.getPage(slug, locale, site);

    // Return response
    return NextResponse.json(pageData);
  } catch (error) {
    console.error('Error fetching CMS data:', error);
    return NextResponse.json({ error: 'Failed to fetch CMS data' }, { status: 500 });
  }
}
