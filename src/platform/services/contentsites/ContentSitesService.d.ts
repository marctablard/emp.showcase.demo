import type { Paginated } from '@/platform/services/model/common';

export interface ContentSiteStyle {
  colourmain?: string;
  coloursecond?: string;
  colourthird?: string;
}

export interface ProductHighlightProduct {
  emporixReferenceType: string;
  id: string;
}

export interface ProductHighlights {
  products?: ProductHighlightProduct[];
}

export interface ContentSite {
  id: string;
  name?: Record<string, string>;
  media?: string[];
  mixins?: {
    sitestyle?: ContentSiteStyle;
    producthighlights?: ProductHighlights;
  };
  metadata?: {
    version?: number;
    createdAt?: string;
    modifiedAt?: string;
    mixins?: Record<string, string>;
  };
}

export interface ContentSiteQuery {
  name?: string;
  page?: number;
  size?: number;
}

export interface ContentSitesService {
  /**
   * Get content sites by query parameters
   * @param query Query parameters including name filter
   * @returns Promise with paginated content sites
   */
  getContentSites(query: ContentSiteQuery): Promise<Paginated<ContentSite>>;

  /**
   * Get a content site by ID
   * @param id Content site ID
   * @returns Promise with the content site or null if not found
   */
  getContentSite(id: string): Promise<ContentSite | null>;
}
