import { EmporixLocalizedString, EmporixMetadata } from './common';

export type ItemAssignmentType = 'PRODUCT' | 'CATEGORY';

export interface ItemAssignmentItem {
  id: string;
  code: string;
  name: EmporixLocalizedString;
}

export interface ItemAssignmentResponse {
  segmentId: string;
  metadata: EmporixMetadata;
  item: ItemAssignmentItem;
  type: ItemAssignmentType;
}

export interface CategoryTreeItemResponse {
  id: string;
  code?: string;
  name: EmporixLocalizedString;
  localizedDescription?: EmporixLocalizedString;
  localizedSlug?: EmporixLocalizedString;
  parentId?: string;
  position?: number;
  published?: boolean;
  isSegmentAssigned?: boolean;
  subcategories?: CategoryTreeItemResponse[];
}

export interface CustomerSegmentQueryParams {
  q?: string;
  pageSize?: number;
  pageNumber?: number;
  sort?: string;
  fields?: string;
  legalEntityId?: string;
  siteCode?: string;
  onlyActive?: boolean;
}
