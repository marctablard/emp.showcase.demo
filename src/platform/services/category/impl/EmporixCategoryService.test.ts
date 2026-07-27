import { EmporixCategoryService } from './EmporixCategoryService';

describe('EmporixCategoryService', () => {
  const categoryApi = {
    getCategory: jest.fn(),
    getCategoriesByIds: jest.fn(),
    getCategories: jest.fn(),
    getCategoryParents: jest.fn(),
    getCategorySubcategories: jest.fn(),
    getCategoriesByReferenceId: jest.fn(),
    getCategoryTree: jest.fn(),
    getCategoryTrees: jest.fn(),
    getAllCategoryTrees: jest.fn(),
    getCategoryAssignments: jest.fn(),
  };

  const categoryMapper = {
    mapToService: jest.fn(),
    mapToSource: jest.fn(),
  };

  const catalogPublishedRootCategoryService = {
    getRootCategoryIdsForSite: jest.fn(),
  };

  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };

  const service = new EmporixCategoryService(
    categoryApi as never,
    categoryMapper as never,
    catalogPublishedRootCategoryService as never,
    logger as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sorts navigation category trees by position and keeps zero/default positions at the end', async () => {
    catalogPublishedRootCategoryService.getRootCategoryIdsForSite.mockResolvedValue([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
    ]);

    categoryApi.getCategoriesByIds.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
      { id: 'e' },
      { id: 'f' },
      { id: 'g' },
      { id: 'h' },
      { id: 'i' },
      { id: 'j' },
      { id: 'k' },
    ]);

    categoryApi.getCategoryTrees.mockResolvedValue([
      { id: 'a', localizedName: { en: 'A' }, position: 0, published: true },
      { id: 'b', localizedName: { en: 'B' }, position: 0, published: true },
      { id: 'c', localizedName: { en: 'C' }, position: 4, published: true },
      { id: 'd', localizedName: { en: 'D' }, position: 0, published: true },
      { id: 'e', localizedName: { en: 'E' }, position: 1, published: true },
      { id: 'f', localizedName: { en: 'F' }, position: 2, published: true },
      { id: 'g', localizedName: { en: 'G' }, position: 2, published: true },
      { id: 'h', localizedName: { en: 'H' }, position: 5, published: true },
      { id: 'i', localizedName: { en: 'I' }, position: 0, published: true },
      { id: 'j', localizedName: { en: 'J' }, position: 1, published: true },
      { id: 'k', localizedName: { en: 'K' }, position: 3, published: true },
    ]);

    const roots = await service.getNavigationCategoryTrees('showcaseqadev', false);

    expect(categoryApi.getCategoryTrees).toHaveBeenCalledWith(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
      false,
    );
    expect(roots.map((root) => root.id)).toEqual(['e', 'j', 'f', 'g', 'k', 'c', 'h', 'a', 'b', 'd', 'i']);
  });
});
