import type { SubMenuItem } from '@/data/navigation-menu';
import { l10n } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';
import { buildBrowseHrefForCategoryId } from './build-browse-category-href';

function sortByPosition(a: Category, b: Category): number {
  return (a.position ?? 0) - (b.position ?? 0);
}

function categoryToSubMenuItem(category: Category, locale: string): SubMenuItem {
  const rawChildren = category.children;
  const childList = Array.isArray(rawChildren)
    ? (rawChildren as Category[]).filter((c) => c && typeof c === 'object' && 'id' in c)
    : [];
  const sortedChildren = childList.slice().sort(sortByPosition);
  const hasSubmenu = sortedChildren.length > 0;

  return {
    id: category.id,
    label: l10n(category.name, locale),
    href: buildBrowseHrefForCategoryId(category.id),
    hasSubmenu,
    submenuItems: hasSubmenu ? sortedChildren.map((c) => categoryToSubMenuItem(c, locale)) : [],
  };
}

/**
 * Maps API category roots (with nested `children`) to header flyout / mobile menu shape.
 */
export function categoriesToSubMenuItems(categories: Category[], locale: string): SubMenuItem[] {
  return categories.slice().sort(sortByPosition).map((c) => categoryToSubMenuItem(c, locale));
}
