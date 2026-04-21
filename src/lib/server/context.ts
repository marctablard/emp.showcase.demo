import type { NextRequest } from 'next/server';
import { getPublicDefaultLanguage, getPublicDefaultSite } from '@/lib/common/public-default-env';

export function getContext(Request: NextRequest): { locale: string; site: string } {
  let locale = process.env.NEXT_PUBLIC_LOCALE_COOKIE
    ? Request.cookies.get(process.env.NEXT_PUBLIC_LOCALE_COOKIE)?.value ||
      Request.headers.get('Accept-Language')?.split(',')[0] ||
      getPublicDefaultLanguage()
    : Request.cookies.get('NEXT_LOCALE')?.value ||
      Request.headers.get('Accept-Language')?.split(',')[0] ||
      getPublicDefaultLanguage();
  if (!locale) {
    locale = getPublicDefaultLanguage();
  }
  let site = process.env.NEXT_PUBLIC_SITE_COOKIE
    ? Request.cookies.get(process.env.NEXT_PUBLIC_SITE_COOKIE)?.value
    : undefined;
  if (!site) {
    site = getPublicDefaultSite();
  }
  return { locale, site };
}
