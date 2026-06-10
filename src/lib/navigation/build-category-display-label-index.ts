import { L10N_MISSING_LABEL, l10n } from '@/lib/l10n';
import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';

/**
 * Flattens navigation category trees into id → display label for `locale`.
 * First non-empty resolved label wins per id (stable preorder walk). Omits {@link L10N_MISSING_LABEL}.
 */
export function buildCategoryDisplayLabelIndex(navigationRoots: Category[], locale: string): Record<string, string> {
  const out: Record<string, string> = {};

  function visit(cat: Category): void {
    const metadata = getBatteryIncludedCategoryMetadata(cat);
    const label = (metadata?.leafLabel ?? l10n(cat.name, locale)).trim();
    if (label && label !== L10N_MISSING_LABEL && !out[cat.id]) {
      out[cat.id] = label;
    }
    if (metadata?.facetValue && label && !out[metadata.facetValue]) {
      out[metadata.facetValue] = label;
    }
    const kids = cat.children;
    if (!Array.isArray(kids)) {
      return;
    }
    for (const child of kids) {
      if (child && typeof child === 'object' && 'id' in child) {
        visit(child as Category);
      }
    }
  }

  for (const root of navigationRoots) {
    visit(root);
  }
  return out;
}
