import type { EmporixCategory, EmporixLocalizedString } from '@/platform/integrations/emporix/model';

/**
 * v2-aware shape of the Emporix Category resource.
 *
 * Extends the platform's `EmporixCategory` with the localized maps and
 * nested-children fields that the v2 endpoints return. The platform model
 * intentionally stays narrow (v1) so generic storefront consumers don't
 * implicitly depend on response fields they don't use; the CMS plugin needs
 * the richer shape because the editor surfaces localized labels and renders
 * a full nested tree.
 */
export interface EmporixCmsCategory extends EmporixCategory {
  localizedName?: EmporixLocalizedString;
  localizedDescription?: EmporixLocalizedString;
  localizedSlug?: EmporixLocalizedString;
  /** v2 tree responses use `subcategories` for nested children. */
  subcategories?: EmporixCmsCategory[];
  /** Some endpoints already return `children`; both forms are accepted. */
  children?: EmporixCmsCategory[];
}
