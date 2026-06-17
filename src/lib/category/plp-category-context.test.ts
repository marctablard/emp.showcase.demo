/**
 * @jest-environment jsdom
 */
import type { Category } from '@/platform/services/model/category';
import { resolvePlpCategoryContext } from './plp-category-context';

describe('resolvePlpCategoryContext', () => {
  const rootLeaf: Category = { id: 'root-leaf' };
  const leaf1: Category = { id: 'leaf-1' };
  const leaf2: Category = { id: 'leaf-2' };
  const parent1: Category = { id: 'parent-1', children: [leaf1, leaf2] };
  const roots: Category[] = [rootLeaf, parent1];

  it('handles no selected category (root)', () => {
    const ctx = resolvePlpCategoryContext(roots, undefined);
    expect(ctx.ancestorTrail).toEqual([]);
    expect(ctx.currentCategory).toBeUndefined();
    expect(ctx.currentChildren).toEqual(roots);
    expect(ctx.ribbonCategories).toEqual(roots);
    expect(ctx.sidebarCountCategoryIds).toEqual(['root-leaf', 'parent-1']);
  });

  it('handles non-leaf selected category', () => {
    const ctx = resolvePlpCategoryContext(roots, 'parent-1');
    expect(ctx.ancestorTrail).toEqual([{ kind: 'virtual-all-products' }]);
    expect(ctx.currentCategory).toEqual(parent1);
    expect(ctx.currentChildren).toEqual([leaf1, leaf2]);
    expect(ctx.ribbonCategories).toEqual([leaf1, leaf2]);
    expect(ctx.sidebarCountCategoryIds).toEqual(['parent-1', 'leaf-1', 'leaf-2']);
  });

  it('handles leaf selected category (siblings)', () => {
    const ctx = resolvePlpCategoryContext(roots, 'leaf-1');
    expect(ctx.ancestorTrail).toEqual([{ kind: 'virtual-all-products' }, { kind: 'category', category: parent1 }]);
    expect(ctx.currentCategory).toEqual(leaf1);
    expect(ctx.currentChildren).toEqual([]);
    expect(ctx.ribbonCategories).toEqual([leaf1, leaf2]);
    expect(ctx.sidebarCountCategoryIds).toEqual(['leaf-1']);
  });

  it('handles root-level leaf selected category (fallback to roots)', () => {
    const ctx = resolvePlpCategoryContext(roots, 'root-leaf');
    expect(ctx.ancestorTrail).toEqual([{ kind: 'virtual-all-products' }]);
    expect(ctx.currentCategory).toEqual(rootLeaf);
    expect(ctx.currentChildren).toEqual([]);
    expect(ctx.ribbonCategories).toEqual(roots);
    expect(ctx.sidebarCountCategoryIds).toEqual(['root-leaf']);
  });

  it('handles missing/invalid category by falling back to root', () => {
    const ctx = resolvePlpCategoryContext(roots, 'does-not-exist');
    expect(ctx.ancestorTrail).toEqual([]);
    expect(ctx.currentCategory).toBeUndefined();
    expect(ctx.currentChildren).toEqual(roots);
    expect(ctx.ribbonCategories).toEqual(roots);
    expect(ctx.sidebarCountCategoryIds).toEqual(['root-leaf', 'parent-1']);
  });
});
