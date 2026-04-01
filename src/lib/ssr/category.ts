import { cache } from 'react';
import { SubMenuItem } from '@/data/navigation-menu';
import { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { Category } from '@/platform/services/model/category';
import { LocalizedString } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';
import { ProductService } from '@/platform/services/product/ProductService';
import ssr from '@/platform/ssr';
import { getRequestSite } from '@/site/server/RequestSite';

const getCategoryService = () => ssr.get<CategoryService>('CategoryService');
const getProductService = () => ssr.get<ProductService>('ProductService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the display name for a category in the requested locale.
 * Category names can be a plain string or a LocalizedString map depending
 * on which API endpoint returned the data.
 */
export function resolveLocalizedName(name: LocalizedString | string | undefined, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] ?? name['en'] ?? Object.values(name)[0] ?? '';
}

/**
 * Converts a list of Category objects into SubMenuItems (two levels deep).
 * Each category becomes a level-1 nav item; its children become level-2 items.
 */
function categoriesToNavItems(categories: Category[], locale: string): SubMenuItem[] {
  return categories
    .filter((cat) => cat.published !== false)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((cat) => {
      const children = (cat.children as Category[] | undefined) ?? [];
      const publishedChildren = children
        .filter((c) => c.published !== false)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      return {
        label: resolveLocalizedName(cat.name as LocalizedString | string, locale),
        href: `/browse/${cat.id}`,
        hasSubmenu: publishedChildren.length > 0,
        submenuItems: publishedChildren.map((child) => ({
          label: resolveLocalizedName(child.name as LocalizedString | string, locale),
          href: `/browse/${child.id}`,
          hasSubmenu: false,
          submenuItems: [],
        })),
      } satisfies SubMenuItem;
    });
}

/**
 * Fallback: builds nav items from the flat /categories endpoint.
 * Used when the tenant has no catalogs or category-trees configured.
 * Reconstructs a two-level tree from parent–child relationships and
 * promotes children of container roots (e.g. "ProductRoot") to level-1.
 */
async function navItemsFromFlatCategories(locale: string): Promise<SubMenuItem[]> {
  const allCategories = await getCategoryService().getCategories();
  if (allCategories.length === 0) return [];

  const childrenOf = new Map<string, Category[]>();
  for (const cat of allCategories) {
    const parentId = cat.parent as string | undefined;
    if (parentId) {
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(cat);
    }
  }

  const roots = allCategories.filter((c) => !c.parent && c.published !== false);
  const navItems: SubMenuItem[] = [];

  for (const root of roots) {
    const directChildren = (childrenOf.get(root.id) ?? []).filter((c) => c.published !== false);

    if (directChildren.length > 0) {
      navItems.push(...categoriesToNavItems(directChildren, locale));
    }
    // Leaf roots without children are skipped (organisational containers that
    // have no navigable content, e.g. "ContentRoot").
  }

  return navItems;
}

// ---------------------------------------------------------------------------
// Navigation categories (used by the Header server component)
// ---------------------------------------------------------------------------

// locale + site are both cache-key dimensions so each site gets its own result.
const _getNavCategories = cache(async (locale: string, site: string): Promise<SubMenuItem[]> => {
  try {
    // Fetch category trees scoped to this site (catalog-filtered) then fall
    // back to the flat /categories endpoint when no trees are available.
    const siteTrees = await getCategoryService().getCategoryTreesForSite(site);

    if (siteTrees.length > 0) {
      const items = categoriesToNavItems(siteTrees, locale);
      if (items.length > 0) return items;
    }

    return await navItemsFromFlatCategories(locale);
  } catch (error) {
    getLogger().error({ error: error instanceof Error ? error.message : String(error) }, 'SSR getNavCategories failed');
    return [];
  }
});

export async function getNavCategories(locale: string): Promise<SubMenuItem[]> {
  const site = await getRequestSite();
  return _getNavCategories(locale, site);
}

// ---------------------------------------------------------------------------
// Category by ID (used by the category PLP)
// ---------------------------------------------------------------------------

const _getCategoryById = cache(async (id: string): Promise<Category | null> => {
  try {
    return await getCategoryService().getCategoryById(id);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), categoryId: id },
      'SSR getCategoryById failed',
    );
    return null;
  }
});

export function getCategoryById(id: string): Promise<Category | null> {
  return _getCategoryById(id);
}

// ---------------------------------------------------------------------------
// Products for a category (used by the category PLP)
// ---------------------------------------------------------------------------

const _getProductsForCategory = cache(
  async (categoryId: string, page: number, pageSize: number): Promise<{ products: Product[]; total: number }> => {
    try {
      const { ids, total } = await getCategoryService().getProductIdsForCategory(categoryId, { page, pageSize });

      if (ids.length === 0) return { products: [], total };

      const productResults = await Promise.all(
        ids.map((id) => getProductService().getProductById(id, { prices: true })),
      );

      // Exclude variant children — only show parent/basic/bundle products.
      // Variants are identified by having a parentVariantId (they belong to a parent product).
      const products = productResults.filter((p: Product | undefined): p is Product => !!p && !p.parentVariantId);
      return { products, total };
    } catch (error) {
      getLogger().error(
        { error: error instanceof Error ? error.message : String(error), categoryId },
        'SSR getProductsForCategory failed',
      );
      return { products: [], total: 0 };
    }
  },
);

export function getProductsForCategory(
  categoryId: string,
  page = 0,
  pageSize = 12,
): Promise<{ products: Product[]; total: number }> {
  return _getProductsForCategory(categoryId, page, pageSize);
}
