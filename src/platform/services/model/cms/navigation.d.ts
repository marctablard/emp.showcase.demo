/**
 * Navigation content surfaced by `CmsAdapter.getNavigation`.
 *
 * Kept in its own module rather than co-located with `cms-content.d.ts`
 * so future per-feature evolution (e.g. nested items, mega-menu blocks)
 * stays scoped without churning the wider CMS model file.
 */
export interface CMSNavigation {
  items: Array<{ title: string; href: string }>;
}
