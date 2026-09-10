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

/**
 * One page of `GET /customer-segment/{tenant}/segments/items`.
 * `totalCount` comes from the opt-in `X-Total-Count` response header; when the header is
 * missing it falls back to `items.length` (pagination then stops after the first page).
 */
export interface ItemAssignmentPageResponse {
  items: ItemAssignmentResponse[];
  totalCount: number;
}

/**
 * Customer segment as returned by `GET /customer-segment/{tenant}/segments` and
 * `GET /customer-segment/{tenant}/me/segments`. Kept tolerant: only `id` is required and
 * unknown fields are preserved (COP-5908 contract not yet observable on api-develop).
 * Observed on `GET /segments` (api-develop, 2026-09-10): `id`, `name`, `description`,
 * `siteCode`, `status`, `metadata`.
 */
export interface SegmentResponse {
  id: string;
  name?: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  status?: string;
  siteCode?: string;
  validity?: { from?: string; to?: string };
  metadata?: EmporixMetadata;
  [key: string]: unknown;
}

export interface CategoryTreeItemResponse {
  id: string;
  code?: string;
  name: EmporixLocalizedString;
  localizedDescription?: EmporixLocalizedString;
  localizedSlug?: EmporixLocalizedString;
  published?: boolean;
  position?: number;
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
