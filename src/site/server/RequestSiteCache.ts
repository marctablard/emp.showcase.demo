import { cache } from 'react';

function getCacheImpl() {
  const value: { site?: string } = { site: undefined };
  return value;
}

const getCache = cache(getCacheImpl);

export function getCachedRequestSite() {
  return getCache().site;
}

export function setCachedRequestSite(site: string) {
  getCache().site = site;
}

export const getRequestSite = getCachedRequestSite;

export const setRequestSite = setCachedRequestSite;
