'use client';

import type { CMSNoResult, CMSPage } from '@/platform/services/model/cms';

/**
 * Get CMS page data from the API
 * @param slug The page slug (default: 'home')
 * @param locale The locale (default: 'de')
 * @param site The site (optional)
 * @returns Promise with the page data or CMSNoResult if not found
 */
export async function getCmsPage(
  slug: string = 'home',
  locale: string = 'de',
  site?: string,
): Promise<CMSPage | CMSNoResult> {
  // Build URL with query parameters
  const params = new URLSearchParams();
  params.append('slug', slug);
  params.append('locale', locale);
  if (site) {
    params.append('site', site);
  }

  // Fetch data from API
  const response = await fetch(`/api/cms?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch CMS data: ${response.statusText}`);
  }

  return await response.json();
}
