import type { Paginated } from '@/platform/services/model/common';

export interface ContentPage {
  id: string;
  name?: Record<string, string>;
  metadata?: {
    version?: number;
    createdAt?: string;
    modifiedAt?: string;
  };
}

export interface ContentPageQuery {
  name?: string;
  page?: number;
  size?: number;
}

export interface ContentPagesService {
  /**
   * Get content pages by query parameters
   * @param query Query parameters including name filter
   * @returns Promise with paginated content pages
   */
  getContentPages(query: ContentPageQuery): Promise<Paginated<ContentPage>>;

  /**
   * Get a content page by ID
   * @param id Content page ID
   * @returns Promise with the content page or null if not found
   */
  getContentPage(id: string): Promise<ContentPage | null>;
}
