'use client';

/**
 * Get the CONTENTSITE id for a specific site code (client-side).
 */
export async function getContentSiteIdBySiteCode(siteCode: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/contentsites?name=${encodeURIComponent(siteCode)}&size=1`);
    if (!response.ok) return null;

    const result = await response.json();
    if (result.items?.length > 0) {
      const contentSite = result.items[0];
      if (contentSite.name?.en === siteCode) {
        return contentSite.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
