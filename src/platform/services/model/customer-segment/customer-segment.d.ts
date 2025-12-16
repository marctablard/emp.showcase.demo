import { LocalizedString, Mixins } from '../common';

export type SegmentItemType = 'PRODUCT' | 'CATEGORY';

export interface SegmentItem {
  id: string;
  code?: string;
  name: LocalizedString;
}

export interface ItemAssignment {
  segmentId: string;
  item: SegmentItem;
  type: SegmentItemType;
  metadata?: {
    createdAt?: string;
    modifiedAt?: string;
    version?: number;
    [key: string]: any;
  };
  mixins?: Mixins;
}

export interface CustomerSegmentQueryOptions {
  q?: string;
  pageSize?: number;
  pageNumber?: number;
  sort?: string;
  fields?: string;
  legalEntityId?: string;
  siteCode?: string;
  onlyActive?: boolean;
}

export interface CategoryTreeNode {
  id: string;
  parentId?: string;
  name: LocalizedString;
  description: LocalizedString;
  position: number;
  published: boolean;
  assignedToSegment: boolean;
  subcategories: CategoryTreeNode[];
}

export interface CategoryTree extends CategoryTreeNode {
  // Root level category tree
}
