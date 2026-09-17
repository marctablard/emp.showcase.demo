import type { Category } from '../../model/category';
import type { CategoryTree, ItemAssignment } from '../../model/customer-segment';
import SegmentFilterService, {
  PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS,
  buildSegmentItemsQuery,
} from './SegmentFilterService';

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

/** Active segment ids of the resolved products mode used by every scope call in these tests. */
const SEGMENTS = ['s1', 's2'];

function productAssignment(productId: string, segmentId = 's1'): ItemAssignment {
  return { segmentId, type: 'PRODUCT', item: { id: productId, name: { en: productId } } };
}

/** Node of the site's published navigation forest (`CategoryService.getNavigationCategoryTrees`). */
function publicNode(id: string, overrides: Partial<Category> = {}): Category {
  return { id, name: { en: id }, description: {}, position: 0, published: true, children: [], ...overrides };
}

/** `assignments/references/{productId}` item — only `id` and `published` are consumed by the graft. */
function referenceCategory(id: string, published = true) {
  return { id, name: { en: id }, published, supercategoriesIds: [] as string[] };
}

function ids(nodes: Category[] | string[] | undefined): string[] {
  return ((nodes ?? []) as Category[]).map((child) => child.id);
}

describe('SegmentFilterService', () => {
  const customerSegmentService = {
    getCategoryTrees: jest.fn(),
    getSegmentItems: jest.fn(),
  };
  const categoryFilterExpansion = { expandCategoryIdsForProductSearch: jest.fn() };
  const productApi = { searchProducts: jest.fn() };
  const categoryApi = { getCategoriesByReferenceId: jest.fn() };
  const categoryService = { getNavigationCategoryTrees: jest.fn() };
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const createService = () =>
    new SegmentFilterService(
      customerSegmentService as never,
      categoryFilterExpansion as never,
      productApi as never,
      categoryApi as never,
      categoryService as never,
      logger as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    categoryFilterExpansion.expandCategoryIdsForProductSearch.mockImplementation(async (ids: string[]) => ids);
    productApi.searchProducts.mockResolvedValue({ items: [], page: 0, size: 0, total: 0 });
    customerSegmentService.getSegmentItems.mockResolvedValue([]);
    categoryApi.getCategoriesByReferenceId.mockResolvedValue({ items: [], page: 0, size: 0, total: 0 });
    categoryService.getNavigationCategoryTrees.mockResolvedValue([]);
  });

  describe('getCategoryScope', () => {
    it('returns an empty scope without upstream calls when segmentIds is empty (fail closed)', async () => {
      const scope = await createService().getCategoryScope('main', []);

      expect(scope).toEqual({ roots: [], treeCategoryIds: [], assignedCategoryIds: [], allowedCategoryIds: [] });
      expect(customerSegmentService.getCategoryTrees).not.toHaveBeenCalled();
      expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
    });

    it('builds tree/assigned/allowed ids from the forest and expands assigned nodes', async () => {
      customerSegmentService.getCategoryTrees.mockResolvedValue([
        node('A', { subcategories: [node('B', { assignedToSegment: true, position: 2 })] }),
      ]);
      categoryFilterExpansion.expandCategoryIdsForProductSearch.mockResolvedValue(['B', 'C']);

      const scope = await createService().getCategoryScope('main', SEGMENTS);

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

      const scope = await createService().getCategoryScope('main', SEGMENTS);

      expect(scope.roots.map((root) => root.id)).toEqual(['A']);
      expect(scope.treeCategoryIds).toEqual(['A', 'B']);
      expect(scope.assignedCategoryIds).toEqual(['B']);
      expect(scope.allowedCategoryIds).toEqual(['A', 'B']);
      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).toHaveBeenCalledWith(['B']);
    });

    it('skips the expansion call when nothing is assigned', async () => {
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);

      const scope = await createService().getCategoryScope('main', SEGMENTS);

      expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).not.toHaveBeenCalled();
      expect(scope.allowedCategoryIds).toEqual(['A']);
    });

    describe('product-assigned categories', () => {
      // Public forest: Home > Tiles, Home > Bath > Towels, Garden (Tiles has a subtree that must NOT be grafted).
      const publicForest = [
        publicNode('Home', {
          position: 1,
          children: [
            publicNode('Bath', { position: 1, children: [publicNode('Towels')] }),
            publicNode('Tiles', { position: 2, children: [publicNode('Mosaic')] }),
          ],
        }),
        publicNode('Garden', { position: 2 }),
      ];

      beforeEach(() => {
        categoryService.getNavigationCategoryTrees.mockResolvedValue(publicForest);
      });

      it('grafts the category of a directly assigned product with its ancestor path as plain nodes', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([]);
        customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('tile-1')]);
        categoryApi.getCategoriesByReferenceId.mockResolvedValue({ items: [referenceCategory('Tiles')] });

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(categoryApi.getCategoriesByReferenceId).toHaveBeenCalledWith('tile-1', true);
        expect(categoryService.getNavigationCategoryTrees).toHaveBeenCalledWith('main', false);
        expect(ids(scope.roots)).toEqual(['Home']);
        expect(ids(scope.roots[0].children)).toEqual(['Tiles']);
        expect(scope.roots[0]).toEqual(
          expect.objectContaining({ id: 'Home', name: { en: 'Home' }, position: 1, published: true }),
        );
        // Path node only: the public subtree of Tiles (Mosaic) is not copied.
        expect((scope.roots[0].children as Category[])[0]).toEqual(
          expect.objectContaining({ id: 'Tiles', position: 2, children: [] }),
        );
        expect(scope.treeCategoryIds).toEqual(['Home', 'Tiles']);
        expect(scope.assignedCategoryIds).toEqual([]);
        expect(scope.allowedCategoryIds).toEqual(['Home', 'Tiles']);
        expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).not.toHaveBeenCalled();
      });

      it('merges into ancestors already present in the forest, keeps siblings sorted and never duplicates', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([
          node('Home', { position: 1, subcategories: [node('Bath', { assignedToSegment: true, position: 1 })] }),
        ]);
        customerSegmentService.getSegmentItems.mockResolvedValue([
          productAssignment('tile-1'),
          productAssignment('tile-2'),
          productAssignment('towel-1'),
        ]);
        categoryApi.getCategoriesByReferenceId.mockImplementation(async (productId: string) => ({
          items: productId === 'towel-1' ? [referenceCategory('Towels')] : [referenceCategory('Tiles')],
        }));

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(ids(scope.roots)).toEqual(['Home']);
        const home = scope.roots[0];
        expect(ids(home.children)).toEqual(['Bath', 'Tiles']);
        const bath = (home.children as Category[])[0];
        expect(ids(bath.children)).toEqual(['Towels']);
        expect(scope.treeCategoryIds).toEqual(['Home', 'Bath', 'Tiles', 'Towels']);
        // Grafted nodes are never assigned; the assigned category keeps its expansion.
        expect(scope.assignedCategoryIds).toEqual(['Bath']);
        expect(categoryFilterExpansion.expandCategoryIdsForProductSearch).toHaveBeenCalledWith(['Bath']);
        expect(scope.allowedCategoryIds).toEqual(['Home', 'Bath', 'Tiles', 'Towels']);
      });

      it('skips unpublished categories and categories outside the published navigation trees', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([]);
        customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('p1')]);
        categoryApi.getCategoriesByReferenceId.mockResolvedValue({
          items: [referenceCategory('Tiles', false), referenceCategory('Hidden')],
        });

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(scope.roots).toEqual([]);
        expect(scope.treeCategoryIds).toEqual([]);
        expect(scope.allowedCategoryIds).toEqual([]);
        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('skips a product whose category lookup fails with a warn and keeps the others', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([]);
        customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('bad'), productAssignment('ok')]);
        const failure = new Error('upstream 500');
        categoryApi.getCategoriesByReferenceId.mockImplementation(async (productId: string) => {
          if (productId === 'bad') {
            throw failure;
          }
          return { items: [referenceCategory('Garden')] };
        });

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(ids(scope.roots)).toEqual(['Garden']);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ err: failure, productId: 'bad', siteCode: 'main' }),
          expect.any(String),
        );
      });

      it('keeps the category-trees forest when the product items lookup fails (warn, no graft)', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([node('A', { assignedToSegment: true })]);
        customerSegmentService.getSegmentItems.mockRejectedValue(new Error('items down'));

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(ids(scope.roots)).toEqual(['A']);
        expect(scope.assignedCategoryIds).toEqual(['A']);
        expect(categoryApi.getCategoriesByReferenceId).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      it('looks up every assigned product and only warns when the set is large', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([]);
        const many = Array.from({ length: PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS + 5 }, (_, i) =>
          productAssignment(`p${i}`),
        );
        customerSegmentService.getSegmentItems.mockResolvedValue(many);
        categoryApi.getCategoriesByReferenceId.mockResolvedValue({ items: [referenceCategory('Garden')] });

        const scope = await createService().getCategoryScope('main', SEGMENTS);

        expect(categoryApi.getCategoriesByReferenceId).toHaveBeenCalledTimes(PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS + 5);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            productCount: PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS + 5,
          }),
          expect.any(String),
        );
        expect(ids(scope.roots)).toEqual(['Garden']);
      });

      it('makes no category API calls when no product is directly assigned', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);
        customerSegmentService.getSegmentItems.mockResolvedValue([]);

        await createService().getCategoryScope('main', SEGMENTS);

        expect(categoryApi.getCategoriesByReferenceId).not.toHaveBeenCalled();
        expect(categoryService.getNavigationCategoryTrees).not.toHaveBeenCalled();
      });

      it('reuses caller-supplied product ids and does not call getSegmentItems again', async () => {
        customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);

        await createService().getCategoryScope('main', SEGMENTS, ['p-supplied']);

        expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
        expect(categoryApi.getCategoriesByReferenceId).toHaveBeenCalledWith('p-supplied', true);
      });
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

      const scope = await createService().getProductScope('main', SEGMENTS);

      expect(customerSegmentService.getSegmentItems).toHaveBeenCalledWith({
        q: 'type:PRODUCT segmentId:(s1,s2)',
        siteCode: 'main',
      });
      expect(scope.productIds).toEqual(['p1', 'p2']);
    });

    it('builds the items query from trimmed, de-duplicated segment ids', () => {
      expect(buildSegmentItemsQuery(['s1', 's2'])).toBe('type:PRODUCT segmentId:(s1,s2)');
    });

    it('excludes assignments of segments outside the active segmentIds (isolation)', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([
        productAssignment('mine', 's1'),
        productAssignment('other-site-or-inactive', 'sX'),
        productAssignment('also-mine', 's2'),
      ]);

      const scope = await createService().getProductScope('main', [' s1', 's2', 's2', '']);

      expect(customerSegmentService.getSegmentItems).toHaveBeenCalledWith({
        q: 'type:PRODUCT segmentId:(s1,s2)',
        siteCode: 'main',
      });
      expect(scope.productIds).toEqual(['mine', 'also-mine']);
    });

    it('returns an empty scope without an upstream call when segmentIds is empty (fail closed)', async () => {
      await expect(createService().getProductScope('main', [])).resolves.toEqual({ productIds: [] });
      await expect(createService().getProductScope('main', ['  '])).resolves.toEqual({ productIds: [] });

      expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
    });
  });

  describe('filterProductIdsInScope', () => {
    it('combines direct assignments with one assigned-category product search', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('p1')]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([
        node('A', { subcategories: [node('B', { assignedToSegment: true })] }),
      ]);
      productApi.searchProducts.mockResolvedValue({ items: [{ id: 'p2' }], page: 0, size: 2, total: 1 });

      const result = await createService().filterProductIdsInScope(['p1', 'p2', 'p3'], 'main', SEGMENTS);

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

      const result = await createService().filterProductIdsInScope(['p1'], 'main', SEGMENTS);

      expect([...result]).toEqual(['p1']);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('returns an empty set without calling the product API when both scopes are empty', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([]);

      const result = await createService().filterProductIdsInScope(['p1', 'p2'], 'main', SEGMENTS);

      expect(result.size).toBe(0);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('ignores unassigned tree nodes (parent path only) for the category search', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('A')]);

      const result = await createService().filterProductIdsInScope(['p1'], 'main', SEGMENTS);

      expect(result.size).toBe(0);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('does not widen membership through grafted product-assigned categories', async () => {
      // `tile-1` is directly assigned and lives in `Tiles`; `tile-2` is another product of `Tiles`.
      customerSegmentService.getSegmentItems.mockResolvedValue([productAssignment('tile-1')]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([node('Home')]);
      categoryApi.getCategoriesByReferenceId.mockResolvedValue({ items: [referenceCategory('Tiles')] });
      categoryService.getNavigationCategoryTrees.mockResolvedValue([
        publicNode('Home', { children: [publicNode('Tiles')] }),
      ]);

      const result = await createService().filterProductIdsInScope(['tile-1', 'tile-2'], 'main', SEGMENTS);

      expect([...result]).toEqual(['tile-1']);
      // No assigned category → no `categoryIds:(…)` search; the graft never feeds membership.
      expect(productApi.searchProducts).not.toHaveBeenCalled();
      expect(categoryApi.getCategoriesByReferenceId).not.toHaveBeenCalled();
    });

    it('short-circuits for an empty input with zero upstream calls', async () => {
      const result = await createService().filterProductIdsInScope([], 'main', SEGMENTS);

      expect(result.size).toBe(0);
      expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
      expect(customerSegmentService.getCategoryTrees).not.toHaveBeenCalled();
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('short-circuits for empty segmentIds with zero upstream calls (fail closed)', async () => {
      const result = await createService().filterProductIdsInScope(['p1'], 'main', []);

      expect(result.size).toBe(0);
      expect(customerSegmentService.getSegmentItems).not.toHaveBeenCalled();
      expect(customerSegmentService.getCategoryTrees).not.toHaveBeenCalled();
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('does not treat a product assigned only through a segment outside segmentIds as in scope (isolation)', async () => {
      customerSegmentService.getSegmentItems.mockResolvedValue([
        productAssignment('mine', 's1'),
        productAssignment('foreign', 'sX'),
      ]);
      customerSegmentService.getCategoryTrees.mockResolvedValue([]);

      const result = await createService().filterProductIdsInScope(['mine', 'foreign'], 'main', SEGMENTS);

      expect([...result]).toEqual(['mine']);
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });
  });
});
