import { cache } from 'react';
import { headers } from 'next/headers';
import { INTERNAL_SITE_HEADER } from '../types';
import { getCachedRequestSite } from './RequestSiteCache';

async function getSiteFromHeaderImpl(): Promise<string> {
  let site;

  try {
    site = (await headers()).get(INTERNAL_SITE_HEADER) || undefined;
    console.log('REQUEST SITE RESOLVED', site);
  } catch (error) {
    console.error('Error getting headers:', error);
  }

  return site || 'main';
}
const getSiteFromHeader = cache(getSiteFromHeaderImpl);

export async function getRequestSite() {
  return getCachedRequestSite() || (await getSiteFromHeader());
}
