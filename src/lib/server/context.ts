import type { NextRequest } from 'next/server';

export function getContext(Request: NextRequest): { locale: string; site: string } {
  let locale = process.env.NEXT_PUBLIC_LOCALE_COOKIE
    ? Request.cookies.get(process.env.NEXT_PUBLIC_LOCALE_COOKIE)?.value ||
      Request.headers.get('Accept-Language')?.split(',')[0] ||
      'en'
    : Request.cookies.get('NEXT_LOCALE')?.value || Request.headers.get('Accept-Language')?.split(',')[0] || 'en';
  if (!locale) {
    locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en';
  }
  let site = process.env.NEXT_PUBLIC_SITE_COOKIE
    ? Request.cookies.get(process.env.NEXT_PUBLIC_SITE_COOKIE)?.value
    : undefined;
  if (!site) {
    const availableSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];
    site = process.env.NEXT_PUBLIC_DEFAULT_SITE || availableSites[0];
  }
  return { locale, site };
}
