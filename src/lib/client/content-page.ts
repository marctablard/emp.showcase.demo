'use client';

export type PageType = 'home' | 'product' | 'search' | 'category';

/**
 * Map a URL pathname to a CONTENTPAGE page type (client-side mirror of ContentPageResolver)
 */
export function getPageTypeFromPathname(pathname: string): PageType {
  const normalizedPath = pathname.replace(/^\/+|\/+$/g, '');

  if (!normalizedPath) return 'home';

  if (normalizedPath.includes('/product/') || normalizedPath.startsWith('product/')) {
    return 'product';
  }

  if (
    normalizedPath.includes('/category/') ||
    normalizedPath.startsWith('category/') ||
    (normalizedPath.includes('/browse/') && normalizedPath.split('/').length > 2) ||
    (normalizedPath.startsWith('browse/') && normalizedPath.split('/').length > 1)
  ) {
    return 'category';
  }

  if (normalizedPath.includes('/browse') || normalizedPath.startsWith('browse')) {
    return 'search';
  }

  return 'home';
}

/**
 * Get the CONTENTPAGE id for a page type (client-side)
 */
export async function getContentPageIdByPageType(pageType: PageType): Promise<string | null> {
  try {
    const response = await fetch(`/api/contentpages?name=${encodeURIComponent(pageType)}&size=10`);
    if (!response.ok) return null;

    const result = await response.json();
    const exactMatch = result.items?.find((item: any) => item.name?.en === pageType);
    return exactMatch?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get the CONTENTPAGE id from a pathname (client-side)
 */
export async function getContentPageIdFromPathname(pathname: string): Promise<string | null> {
  const pageType = getPageTypeFromPathname(pathname);
  return getContentPageIdByPageType(pageType);
}
