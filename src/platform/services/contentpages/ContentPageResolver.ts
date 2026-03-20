import type { ContentPagesService } from './ContentPagesService';

export type PageType = 'home' | 'product' | 'search' | 'category';

/**
 * Resolves the current CONTENTPAGE entity id based on the current URL pathname.
 * The name.en of a CONTENTPAGE matches the page type string (home, product, search, category).
 */
export class ContentPageResolver {
  private static cache: Map<string, string> = new Map();

  private static getSearchTermForPageType(pageType: PageType): string {
    return pageType;
  }

  /**
   * Determine the page type from a URL pathname.
   */
  static getPageTypeFromPathname(pathname: string): PageType {
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
   * Get the CONTENTPAGE entity id for a page type.
   */
  static async getContentPageIdByPageType(
    pageType: PageType,
    contentPagesService: ContentPagesService,
  ): Promise<string | null> {
    const searchTerm = this.getSearchTermForPageType(pageType);

    if (this.cache.has(searchTerm)) {
      return this.cache.get(searchTerm) || null;
    }

    try {
      const result = await contentPagesService.getContentPages({ name: searchTerm, size: 10 });
      const exactMatch = result.items.find((item) => item.name?.en === searchTerm);

      if (exactMatch) {
        this.cache.set(searchTerm, exactMatch.id);
        return exactMatch.id;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the CONTENTPAGE entity id from a URL pathname.
   */
  static async getContentPageIdFromPathname(
    pathname: string,
    contentPagesService: ContentPagesService,
  ): Promise<string | null> {
    const pageType = this.getPageTypeFromPathname(pathname);
    return this.getContentPageIdByPageType(pageType, contentPagesService);
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static clearCacheForPageType(pageType: PageType): void {
    const searchTerm = this.getSearchTermForPageType(pageType);
    this.cache.delete(searchTerm);
  }
}
