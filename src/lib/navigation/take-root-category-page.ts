export type RootCategoryPage<T> = {
  visible: T[];
  truncated: boolean;
  total: number;
};

/**
 * First page of root categories for nav/footer when total exceeds configured page size.
 */
export function takeRootCategoryPage<T>(items: T[], pageSize: number): RootCategoryPage<T> {
  const total = items.length;
  const truncated = total > pageSize;
  return {
    visible: truncated ? items.slice(0, pageSize) : items,
    truncated,
    total,
  };
}
