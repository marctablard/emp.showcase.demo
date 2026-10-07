// CMS Component Types
export interface CMSPage {
  title: string;
  description: string;
  url: string;
  components: CMSComponent[];
  no_margin?: boolean;
  template?: string; // Reference to a template
  /**
   * Id of the layout frame this page renders into. Resolved by the page
   * shell via `CmsAdapter.getLayout(layoutId ?? 'default', ...)`. Absent
   * pages fall back to the `default` layout (or, when no layout resolves,
   * render their body directly).
   */
  layoutId?: string;
}

/**
 * The "no content" sentinel returned by every CMS accessor on a miss. The
 * `notfound` discriminator is a `true` literal (never `false`/absent): a real
 * `CMSPage`/`CMSLayout`/`CMSNavigation` payload never carries the key, so its
 * presence-with-`true` is the single, unambiguous discriminator across the
 * union. Use `isCmsNoResult` (in `services/cms/cms-no-result`) to test it.
 */
export interface CMSNoResult {
  notfound: true;
  message?: string;
}

// Re-export the strict, schema-derived CMSComponent type from the
// schema-aggregate. This is a build-time-only type import (no runtime UI
// code reaches the Domain layer). The discriminated union is the
// source of truth for adapter validation and renderer lookup.
export type { CMSComponent } from '@/components/cms/component-schema';

// `CMSLayout` is structurally the `layout` CMS component (the per-page
// frame fetched via `CmsAdapter.getLayout`). Re-exported from the
// schema-aggregate as the Domain-layer alias so adapters return a single
// canonical type without re-declaring its shape.
export type { LayoutData as CMSLayout } from '@/components/cms/component-schema';
