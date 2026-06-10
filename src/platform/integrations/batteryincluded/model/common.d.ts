import { EmporixMedia } from '@/platform/integrations/emporix/model/common';

export interface BatteryIncludedBrowseVariables {
  locale?: string;
  siteAware?: string;
  countryAware?: string;
}

export interface BatteryIncludedSearchParams<T> {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
  locale?: string;
  analyze?: 0 | 1;
  preset?: string;
  variables?: BatteryIncludedBrowseVariables;
  filters?: Record<string, string | string[] | Record<string, string | number>>;
}

export interface BatteryIncludedFacetCountRowData {
  displayPath?: string;
  idPath?: string;
  [key: string]: unknown;
}

export interface BatteryIncludedFacetCountRow {
  count: number;
  value: string;
  data?: BatteryIncludedFacetCountRowData;
}

export interface BatteryIncludedFacetCount {
  counts: BatteryIncludedFacetCountRow[];
  field_name: string;
  stats: {
    total_values: number;
  };
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

export interface BatteryIncludedSuggestion {
  text: string;
  count: number;
}
