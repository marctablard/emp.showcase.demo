import type { CategoryTree, ItemAssignment } from '../../model/customer-segment';
import SegmentFilterService from './SegmentFilterService';

function node(id: string, overrides: Partial<CategoryTree> = {}): CategoryTree {
  return {
    id,
    name: { en: id },
    description: {},
    position: 0,
    published: true,
    assignedToSegment: false,
    subcategories: [],
    ...overrides,
  };
}

function productAssignment(productId: string): ItemAssignment {
  return { segmentId: 's1', type: 'PRODUCT', item: { id: productId, name: { en: productId } } };
}

describe('SegmentFilterService', () => {
  const customerSegmentService = {
    getCategoryTrees: jest.fn(),
    getSegmentItems: jest.fn(),
  };
  const categoryFilterExpansion = { expandCategoryIdsForProductSearch: jest.fn() };
  const productApi = { searchProducts: jest.fn() };
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const createService = () =>
    new SegmentFilterService(
      customerSegmentService as never,
      categoryFilterExpansion as never,
      productApi as never,
      logger as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    categoryFilterExpansion.expandCategoryIdsForProductSearch.mockImplementation(async (ids: string[]) => ids);
    productApi.searchProducts.mockResolvedValue({ items: [], page: 0, size: 0, total: 0 });
  });

  describe('getCategoryScope', () => {
    it('builds tree/assigned/allowed ids from the forest and expands assigned nodes', async () => {
      customerSegmentService.getCategoryTrees.mockResolvedValue([
        node('A', { subcategories: [node('B', { assignedToSegment: true, position: 2 })] }),
      ]);
      categoryFilterExpansion.expandCategoryIdsForProductSearch.mockResolvedValue(['B', 'C']);

      const scope = await createService().getCategoryScope('main');

      expect(customerSegmentService.getCategoryTrees).toHaveBeenCalledWith({ siteCode: 'main' });
      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).toHaveBeenCalledWith(['B']);
      expect(scope.treeCategoryIds).toEqual(['A', 'B']);
      expect(scope.assignedCategoryIds).toEqual(['B']);
      expect(scope.allowedCategoryIds).toEqual(['A', 'B', 'C']);
      expect(scope.roots).toHaveLength(1);
      expect(scope.roots[0].id).toBe('A');
      expect((scope.roots[0].children as { id: string }[])[0].id).toBe('B');
      expect(scope.roots[0].children?.[0]).toEqual(
        expect.objectContaining({ id: 'B', name: { en: 'B' }, position: 2, published: true, children: [] }),
      );
    });

    it('drops unpublished nodes (with their subtree) from every id set', async () => {
      customerSegmentService.getCategoryTrees.mockResolvedValue([
        node('A', {
          subcategories: [
            node('B', { assignedToSegment: true }),
            node('U', { published: false, assignedToSegment: true, subcategories: [node('UC')] }),
          ],
        }),
        node('R', { published: false }),
      ]);

      const scope = await createService().getCategoryScope('main');

      expect(scope.roots.map((root) => root.id)).toEqual(['A']);
      expect(scope.treeCategoryIds).toEqual(['A', 'B']);
      expect(scope.assignedCategoryIds).toEqual(['B']);
      expect(scope.allowedCategoryIds).toEqual(['A', 'B']);
      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).toHaveBeenCalledWith(['B']);
    });

    it('skips the expansion call when nothing is assigned', async () => {
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);

      const scope = await createService().getCategoryScope('main');

      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).not.toHaveBeenCalled();
      expect(scope.allowedCategoryIds).toEqual(['A']);
    });
  });

  describe('getProductScope', () => {
    it('queries PRODUCT items for the site and de-duplicates ids', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([
        productAssignment('p1'),
        productAssignment('p1'),
        productAssignment('p2'),
        { segmentId: 's1', type: 'CATEGORY', item: { id: 'c1', name: { en: 'c1' } } },
      ]);

      const scope = await createService().getProductScope('main');

      expect(customerSegmentService.getSegmentItems).toHaveBeenCalledWith({ q: 'type:PRODUCT', siteCode: 'main' });
      expect(scope.productIds).toEqual(['p1', 'p2']);
    });
  });

  describe('filterProductIdsInScope', () => {
    it('combines direct assignments with one assigned-category product search', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('p1')]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([
        node('A', { subcategories: [node('B', { assignedToSegment: true })] }),
      ]);
      productApi.searchProducts.mockResolvedValue({ items: [{ id: 'p2' }], page: 0, size: 2, total: 1 });

      const result = await createService().filterProductIdsInScope(['p1', 'p2', 'p3'], 'main');

      expect([...result].sort()).toEqual(['p1', 'p2']);
      expect(productApi.searchProducts).toHaveBeenCalledTimes(1);
      expect(productApi.searchProducts).toHaveBeenCalledWith({
        page: 0,
        size: 2,
        criteria: { id: '(p2,p3)', categoryIds: '(B)' },
      });
      // Membership never needs the descendant expansion.
      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).not.toHaveBeenCalled();
    });

    it('does not search when every candidate is directly assigned', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('p1')]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('B', { assignedToSegment: true })]);

      const result = await createService().filterProductIdsInScope(['p1'], 'main');

      expect([...result]).toEqual(['p1']);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('returns an empty set without calling the product API when both scopes are empty', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([]);

      const result = await createService().filterProductIdsInScope(['p1', 'p2'], 'main');

      expect(result.size).toBe(0);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('ignores unassigned tree nodes (parent path only) for the category search', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);

      const result = await createService().filterProductIdsInScope(['p1'], 'main');

      expect(result.size).toBe(0);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('short-circuits for an empty input with zero upstream calls', async () => {
      const result = await createService().filterProductIdsInScope([], 'main');

      expect(result.size).toBe(0);
      expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
      expect(customerSegmentService.getCategoryTrees).not.toHaveBeenCalled();
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });
  });
});
