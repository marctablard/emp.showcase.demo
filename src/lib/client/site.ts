'use client';

import { Site } from '@/platform/services/model/common/site';

export async function getSites(): Promise<{ current: Site; available: Site[] }> {
  const response = await fetch('/api/site/');

  if (!response.ok) {
    throw new Error(`Failed to fetch site data: ${response.statusText}`);
  }

  return await response.json();
}

export async function getSite(id: string): Promise<Site> {
  const response = await fetch('/api/site/' + id);

  if (!response.ok) {
    throw new Error(`Failed to fetch site data: ${response.statusText}`);
  }

  return await response.json();
}
