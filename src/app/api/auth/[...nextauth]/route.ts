import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handlers } from '@/auth/auth';
import { getContext } from '@/lib/server/context';
import { getBaseUrl } from '@/lib/server/url-utils';

export async function GET(req: NextRequest) {
  const response = await handlers.GET(req);
  if (response.headers.get('Location')) {
    // Since AuthJS can't determine which site and locale to use,
    // we need to do it ourselves
    const { locale, site } = getContext(req);
    const location = response.headers.get('Location')!;
    if (!location.startsWith('/')) {
      const locationUrl = new URL(location);
      if (locationUrl.searchParams.has('error')) {
        const newUrl = locationUrl.pathname.startsWith('/api')
          ? `${getBaseUrl(req)}${locationUrl.pathname}${locationUrl.search}`
          : `${getBaseUrl(req)}/${site}/${locale}${locationUrl.pathname}${locationUrl.search}`;
        return NextResponse.redirect(newUrl);
      }
    }
  }
  return response;
}

export async function POST(req: NextRequest) {
  return await handlers.POST(req);
}
