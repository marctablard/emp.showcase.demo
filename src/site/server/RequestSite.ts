import { cache } from 'react';
import { headers } from 'next/headers';
import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { INTERNAL_SITE_HEADER } from '../types';
import { getCachedRequestSite } from './RequestSiteCache';

async function getSiteFromHeaderImpl(): Promise<string> {
  let site;

  try {
    site = (await headers()).get(INTERNAL_SITE_HEADER) || undefined;
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const digest =
      typeof error === 'object' && error !== null && 'digest' in error
        ? String((error as { digest?: unknown }).digest)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    const isBenignDynamicContext =
      digest.includes('DYNAMIC') ||
      /dynamic server usage|outside a request scope|static generation|headers\(\)/i.test(message);

    if (isBenignDynamicContext) {
      logger.debug(
        { event: 'request_headers_unavailable', digest: digest || undefined },
        'headers() unavailable in this context — falling back to default site',
      );
    } else {
      logger.error({ err: error }, 'Error getting headers');
    }
  }

  return site || getPublicDefaultSite();
}
const getSiteFromHeader = cache(getSiteFromHeaderImpl);

export async function getRequestSite() {
  return getCachedRequestSite() || (await getSiteFromHeader());
}
