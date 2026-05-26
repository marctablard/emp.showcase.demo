// CMS Component Types
export interface CMSPage {
  title: string;
  description: string;
  url: string;
  components: CMSComponent[];
  no_margin?: boolean;
  template?: string; // Reference to a template
}

export interface CMSNoResult {
  notfound?: boolean;
  message?: string;
}

// Re-export the strict, schema-derived CMSComponent type from the
// schema-aggregate. This is a build-time-only type import (no runtime UI
// code reaches the Domain layer). The discriminated union is the
// source of truth for adapter validation and renderer lookup.
export type { CMSComponent } from '@/components/cms/component-schema';
