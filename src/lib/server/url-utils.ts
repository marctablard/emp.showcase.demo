import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';
import type { NextRequest } from 'next/server';

export function getBaseUrl(req: NextRequest, fallbackBaseUrl?: string): string {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (fallbackBaseUrl) {
    return fallbackBaseUrl;
  }

  return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export function getBaseUrlFromHeaders(headers: ReadonlyHeaders, fallbackBaseUrl: string): string {
  const forwardedProto = headers.get('x-forwarded-proto');
  const forwardedHost = headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return fallbackBaseUrl;
}
