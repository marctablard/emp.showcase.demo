import { EmporixMedia } from '@/platform/integrations/emporix/model/common';
import type { SearchFilters } from '@/platform/services/model/common';

export interface BatteryIncludedBrowseVariables {
  locale?: string;
  siteAware?: string;
  countryAware?: string;
  currencyAware?: string;
}

export type BatteryIncludedVisibilityFilters = SearchFilters;

export interface BatteryIncludedVisibilityContext {
  variables?: BatteryIncludedBrowseVariables;
  filters?: BatteryIncludedVisibilityFilters;
}

export interface BatteryIncludedSearchParams<T> {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
  variants?: 0 | 1;
  locale?: string;
  analyze?: 0 | 1;
  preset?: string;
  variables?: BatteryIncludedBrowseVariables;
  visibility?: BatteryIncludedVisibilityContext;
  filters?: Record<string, string | string[] | Record<string, string | number>>;
}

export interface BatteryIncludedFacetCountRowData {
  displayPath?: string;
  idPath?: string;
  position?: number;
  [key: string]: unknown;
}

export interface BatteryIncludedFacetCountRow {
  count: number;
  value: string;
  data?: BatteryIncludedFacetCountRowData;
}

export interface BatteryIncludedFacetStats {
  total_values?: number;
  min?: number;
  max?: number;
  [key: string]: unknown;
}

export interface BatteryIncludedFacetCount {
  counts?: BatteryIncludedFacetCountRow[];
  field_label?: string;
  field_name: string;
  stats?: BatteryIncludedFacetStats;
  type: 'select' | 'range';
}

export interface BatteryIncludedSearchResponse<T> {
  hits: Array<{ document: T }>;
  found: number;
  page: number;
  size: number;
  facet_counts: BatteryIncludedFacetCount[];
}

export interface BatteryIncludedMedia extends EmporixMedia {
  // same as EmporixMedia
}

export interface BatteryIncludedPreset {
  id: string;
  name: string;
  description?: string;
  query?: string;
  filters?: Record<string, any>;
  sort?: string;
}

export interface BatteryIncludedHighlight {
  id: string;
  name: string;
  description?: string;
  products: string[];
}

export interface BatteryIncludedSuggestParams {
  query: string;
  variables?: BatteryIncludedBrowseVariables;
  visibility?: BatteryIncludedVisibilityContext;
  segmentIds?: string[];
}

/** BI recommendation relation type returned by the recommendations endpoint */
export type BatteryIncludedRecommendationType = 'also' | 'together' | 'related';

export interface BatteryIncludedRecommendationHit<T = Record<string, unknown>> {
  document: T;
  type?: BatteryIncludedRecommendationType;
}

export interface BatteryIncludedSuggestionQueryCompletionHit {
  value: string;
  count?: number;
}

export interface BatteryIncludedSuggestionDocumentHit<T> {
  highlighted: T;
  [key: string]: unknown;
}

export interface BatteryIncludedSuggestionFacetHit extends BatteryIncludedFacetCountRow {
  highlighted?: string;
}

export interface BatteryIncludedSuggestionQueryCompletionGroup {
  kind: 'query-completion';
  hits: BatteryIncludedSuggestionQueryCompletionHit[];
}

export interface BatteryIncludedSuggestionDocumentGroup<T> {
  kind: 'document';
  hits: BatteryIncludedSuggestionDocumentHit<T>[];
}

export interface BatteryIncludedSuggestionFacetGroup {
  kind: `facet.${string}`;
  hits: BatteryIncludedSuggestionFacetHit[];
}

export type BatteryIncludedSuggestion<T> =
  | BatteryIncludedSuggestionQueryCompletionGroup
  | BatteryIncludedSuggestionDocumentGroup<T>
  | BatteryIncludedSuggestionFacetGroup;
