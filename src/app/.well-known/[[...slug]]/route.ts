import { NextResponse } from 'next/server';

/**
 * Browsers and tools probe `/.well-known/*` (e.g. Chrome DevTools). Those URLs must not be handled by
 * `app/[site]/[locale]/…` or the first segment is misread as a storefront `site` code and leaks into
 * Emporix `publishedSite` and other site-scoped calls.
 */
export function GET(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export function HEAD(): NextResponse {
  return new NextResponse(null, { status: 404 });
}
