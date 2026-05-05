import { l10n as l10nFn } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';
import type { CategoryTreeNode } from '../types';

/**
 * Build a localized URL path from the category's own slug and its ancestor
 * slugs (via `parent` chain when available). Falls back to `/category/<code>`
 * or `/category/?id=<id>` when no slug chain can be reconstructed.
 */
function buildPath(cat: Category, locale: string, inheritedPath?: string): string | undefined {
  const slug = l10nFn(cat.slug, locale);
  if (!slug) {
    if (cat.code) return `/category/${cat.code}`;
    return undefined;
  }
  if (inheritedPath) {
    return `${inheritedPath.replace(/\/$/, '')}/${slug.replace(/^\//, '')}`;
  }
  return slug.startsWith('/') ? slug : `/${slug}`;
}

/**
 * Transform an internal {@link Category} tree into the {@link CategoryTreeNode}
 * shape expected by the CMS editor (localized `name`, flat `level`, nested
 * `children`, plus any metadata the editor can surface).
 *
 * Both the nested `Category[]` and flat `string[]` forms of `children` are
 * handled — flat forms are simply dropped (no ids to resolve client-side).
 */
export function categoryToTreeNodes(roots: Category[] | null | undefined, locale: string): CategoryTreeNode[] {
  if (!roots || roots.length === 0) return [];

  const walk = (
    cat: Category,
    level: number,
    parentId: string | undefined,
    parentPath: string | undefined,
  ): CategoryTreeNode => {
    const slug = l10nFn(cat.slug, locale) || undefined;
    const path = buildPath(cat, locale, parentPath);
    const childCategories = ((cat.children ?? []) as unknown[]).filter(
      (c): c is Category => !!c && typeof c === 'object' && 'id' in (c as object),
    );

    const node: CategoryTreeNode = {
      id: cat.id,
      name: l10nFn(cat.name, locale) || cat.code || cat.id,
      level,
      parentId,
    };

    if (slug) node.slug = slug;
    if (path) node.path = path;

    if (childCategories.length > 0) {
      node.children = childCategories.map((child) => walk(child, level + 1, cat.id, path));
    }

    const image = cat.media?.[0]?.url;
    if (image) {
      node.metadata = { image };
    }

    return node;
  };

  return roots.map((root) => walk(root, 0, undefined, undefined));
}
