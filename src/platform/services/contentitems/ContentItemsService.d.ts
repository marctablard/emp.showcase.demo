import type { Paginated } from '@/platform/services/model/common';

export interface ContentItemDescription {
  language: string;
  value: string;
}

export interface ContentItemContent {
  buttonlink?: string;
  buttonlinktype?: string;
  description?: ContentItemDescription[];
}

export interface ContentItemStyle {
  display?: string;
  has_background?: boolean;
}

export interface ContentItemRelations {
  categories?: {
    emporixReferenceType: string;
    id: string;
  };
  contentpages?: {
    emporixReferenceType: string;
    id: string;
  };
  contentsites?: {
    emporixReferenceType: string;
    id: string;
  };
  products?: {
    emporixReferenceType: string;
    id: string;
  };
}

export interface ContentItem {
  id: string;
  name?: Record<string, string>;
  media?: string[];
  mixins?: {
    style?: ContentItemStyle;
    relations?: ContentItemRelations;
    content?: ContentItemContent;
  };
  metadata?: {
    version?: number;
    createdAt?: string;
    modifiedAt?: string;
    mixins?: Record<string, string>;
  };
}

export interface ContentItemQuery {
  siteId?: string;
  pageId?: string;
  productId?: string;
  categoryId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface ContentItemsService {
  /**
   * Get content items by query parameters
   * @param query Query parameters including site, page, product, and/or category filters
   * @returns Promise with paginated content items
   */
  getContentItems(query: ContentItemQuery): Promise<Paginated<ContentItem>>;

  /**
   * Get a content item by ID
   * @param id Content item ID
   * @returns Promise with the content item or null if not found
   */
  getContentItem(id: string): Promise<ContentItem | null>;
}
