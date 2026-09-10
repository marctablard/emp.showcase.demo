import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import {
  getNavigationCategoryTreesForMode,
  getProductsModeContext,
  getSegmentCategoryScope,
  getSegmentNavigationRoots,
  isSegmentedMode,
} from './products-mode';

jest.mock('@/platform/ssr', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(),
}));

jest.mock('./navigation-category-trees', () => ({
  __esModule: true,
  getCachedNavigationCategoryTrees: jest.fn(),
  getCachedBatteryIncludedCategorySnapshot: jest.fn(),
}));

jest.mock('./search-engine', () => ({
  __esModule: true,
  getActiveSearchEngine: jest.fn(),
}));

jest.mock('./session', () => ({
  __esModule: true,
  getSessionForSite: jest.fn(),
}));

const mockedSsr = jest.requireMock('@/platform/ssr') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};
const { cookies } = jest.requireMock('next/headers') as { cookies: jest.Mock };
const { getCachedNavigationCategoryTrees, getCachedBatteryIncludedCategorySnapshot } = jest.requireMock(
  './navigation-category-trees',
) as {
  getCachedNavigationCategoryTrees: jest.Mock;
  getCachedBatteryIncludedCategorySnapshot: jest.Mock;
};
const { getActiveSearchEngine } = jest.requireMock('./search-engine') as { getActiveSearchEngine: jest.Mock };
const { getSessionForSite } = jest.requireMock('./session') as { getSessionForSite: jest.Mock };

function buildContext(overrides: Partial<ProductsModeContext> = {}): ProductsModeContext {
  return {
    mode: 'anonymous',
    segmentIds: [],
    canToggleAllProducts: false,
    engine: 'batteryincluded',
    siteCode: 'main',
    ...overrides,
  };
}

describe('products-mode SSR helpers', () => {
  const productsModeService = { resolve: jest.fn() };
  const segmentFilterService = { getCategoryScope: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('ProductsModeService', productsModeService);
    mockedSsr.default.__services.set('SegmentFilterService', segmentFilterService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) });
    getActiveSearchEngine.mockReturnValue('batteryincluded');
    getSessionForSite.mockResolvedValue(null);
    getCachedBatteryIncludedCategorySnapshot.mockResolvedValue(null);
  });

  describe('getProductsModeContext', () => {
    it('forwards the opt-in cookie value and siteCode to ProductsModeService.resolve', async () => {
      const cookieGet = jest.fn().mockReturnValue({ name: 'next-products-mode', value: 'all.cust-1' });
      cookies.mockResolvedValue({ get: cookieGet });
      const resolved = buildContext({ mode: 'all', segmentIds: ['seg-1'], canToggleAllProducts: true });
      productsModeService.resolve.mockResolvedValue(resolved);

      await expect(getProductsModeContext('main')).resolves.toBe(resolved);

      expect(cookieGet).toHaveBeenCalledWith('next-products-mode');
      expect(productsModeService.resolve).toHaveBeenCalledTimes(1);
      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.cust-1', siteCode: 'main' });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('forwards an undefined cookie value when the cookie is absent', async () => {
      productsModeService.resolve.mockResolvedValue(buildContext());

      await getProductsModeContext('us-branch');

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: 'us-branch' });
    });

    it('logs and rethrows when resolve rejects for a logged-in customer (no full-catalog fallback)', async () => {
      const failure = new Error('resolver exploded');
      productsModeService.resolve.mockRejectedValue(failure);
      getSessionForSite.mockResolvedValue({ id: 's-1', siteCode: 'main', customerId: 'cust-1' });

      await expect(getProductsModeContext('main')).rejects.toBe(failure);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, siteCode: 'main', customerId: 'cust-1' }),
        expect.stringContaining('fail closed'),
      );
    });

    it('logs and rethrows when resolve rejects and the session lookup itself failed', async () => {
      const failure = new Error('resolver exploded');
      productsModeService.resolve.mockRejectedValue(failure);
      getSessionForSite.mockResolvedValue(undefined);

      await expect(getProductsModeContext('main')).rejects.toBe(failure);

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('logs and falls back to anonymous mode when resolve rejects and the session has no customer', async () => {
      const failure = new Error('resolver exploded');
      productsModeService.resolve.mockRejectedValue(failure);
      getSessionForSite.mockResolvedValue({ id: 's-1', siteCode: 'main' });
      getActiveSearchEngine.mockReturnValue('emporix');

      await expect(getProductsModeContext('main')).resolves.toEqual({
        mode: 'anonymous',
        segmentIds: [],
        canToggleAllProducts: false,
        engine: 'emporix',
        siteCode: 'main',
      });

      expect(getSessionForSite).toHaveBeenCalledWith('main');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, siteCode: 'main' }),
        expect.stringContaining('anonymous'),
      );
    });

    it('falls back to anonymous mode when resolve rejects for the Emporix "ANONYMOUS" session customerId', async () => {
      const failure = new Error('resolver exploded');
      productsModeService.resolve.mockRejectedValue(failure);
      getSessionForSite.mockResolvedValue({ id: 's-1', siteCode: 'main', customerId: 'ANONYMOUS' });

      await expect(getProductsModeContext('main')).resolves.toEqual({
        mode: 'anonymous',
        segmentIds: [],
        canToggleAllProducts: false,
        engine: 'batteryincluded',
        siteCode: 'main',
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, siteCode: 'main' }),
        expect.stringContaining('anonymous'),
      );
    });

    it('falls back to anonymous mode when resolve rejects and there is no session at all', async () => {
      productsModeService.resolve.mockRejectedValue(new Error('boom'));
      getSessionForSite.mockResolvedValue(null);

      await expect(getProductsModeContext('main')).resolves.toMatchObject({ mode: 'anonymous', segmentIds: [] });
    });
  });

  describe('getSegmentCategoryScope', () => {
    it('delegates to SegmentFilterService.getCategoryScope with the siteCode', async () => {
      const scope = { roots: [], treeCategoryIds: [], assignedCategoryIds: [], allowedCategoryIds: [] };
      segmentFilterService.getCategoryScope.mockResolvedValue(scope);

      await expect(getSegmentCategoryScope('main')).resolves.toBe(scope);

      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('main');
    });

    it('logs and returns an empty scope when the service rejects (fail closed, no crash)', async () => {
      const failure = new Error('Forbidden');
      segmentFilterService.getCategoryScope.mockRejectedValue(failure);

      await expect(getSegmentCategoryScope('main')).resolves.toEqual({
        roots: [],
        treeCategoryIds: [],
        assignedCategoryIds: [],
        allowedCategoryIds: [],
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, siteCode: 'main' }),
        expect.stringContaining('fail closed'),
      );
    });

    it('wraps a non-Error rejection as a string in the log context', async () => {
      segmentFilterService.getCategoryScope.mockRejectedValue('boom');

      await expect(getSegmentCategoryScope('main')).resolves.toMatchObject({ roots: [] });

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: 'boom' }), expect.any(String));
    });
  });

  describe('isSegmentedMode', () => {
    it.each([
      ['anonymous', false],
      ['unsegmented', false],
      ['assigned', true],
      ['all', false],
    ] as const)('returns %s → %s', (mode, expected) => {
      expect(isSegmentedMode({ mode })).toBe(expected);
    });
  });

  describe('getSegmentNavigationRoots', () => {
    const segmentChild: Category = { id: 'seg-child', name: { en: 'Sheets' }, children: [] };
    const segmentRoots: Category[] = [{ id: 'seg-root', name: { en: 'Metals' }, children: [segmentChild] }];
    const snapshot = {
      roots: [],
      byId: {
        'seg-root': {
          id: 'seg-root',
          displayPath: 'Metals',
          facetValue: 'Metals',
          labelPath: 'Metals',
          leafLabel: 'Metals',
          publicationAnchorId: 'seg-root',
          count: 30,
          idPath: ['seg-root'],
        },
        'seg-child': {
          id: 'seg-child',
          displayPath: 'Metals > Sheets',
          facetValue: 'Metals > Sheets',
          labelPath: 'Metals > Sheets',
          leafLabel: 'Sheets',
          publicationAnchorId: 'seg-root',
          count: 30,
          idPath: ['seg-root', 'seg-child'],
        },
      },
      byFacetValue: {},
      countsById: {},
    };

    beforeEach(() => {
      segmentFilterService.getCategoryScope.mockResolvedValue({
        roots: segmentRoots,
        treeCategoryIds: ['seg-root', 'seg-child'],
        assignedCategoryIds: ['seg-root'],
        allowedCategoryIds: ['seg-root', 'seg-child'],
      });
    });

    it('attaches BI category metadata (without the public count) when the BI snapshot is available', async () => {
      getCachedBatteryIncludedCategorySnapshot.mockResolvedValue(snapshot);

      const roots = await getSegmentNavigationRoots('main', 'en');

      expect(getCachedBatteryIncludedCategorySnapshot).toHaveBeenCalledWith('main', 'en');
      expect(roots).toHaveLength(1);
      expect(getBatteryIncludedCategoryMetadata(roots[0])).toEqual({
        source: 'batteryincluded',
        displayPath: 'Metals',
        facetValue: 'Metals',
        labelPath: 'Metals',
        leafLabel: 'Metals',
        publicationAnchorId: 'seg-root',
        idPath: ['seg-root'],
      });
      const [child] = roots[0].children as Category[];
      expect(getBatteryIncludedCategoryMetadata(child)).toMatchObject({ displayPath: 'Metals > Sheets' });
      expect(getBatteryIncludedCategoryMetadata(child)).not.toHaveProperty('count');
      // The service-owned scope stays un-enriched.
      expect(getBatteryIncludedCategoryMetadata(segmentRoots[0])).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns the roots unchanged when the BI snapshot is null', async () => {
      getCachedBatteryIncludedCategorySnapshot.mockResolvedValue(null);

      const roots = await getSegmentNavigationRoots('main', 'en');

      expect(roots).toEqual(segmentRoots);
      expect(getBatteryIncludedCategoryMetadata(roots[0])).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('skips the snapshot lookup and returns the raw roots on the Emporix engine', async () => {
      getActiveSearchEngine.mockReturnValue('emporix');

      await expect(getSegmentNavigationRoots('main', 'en')).resolves.toBe(segmentRoots);

      expect(getCachedBatteryIncludedCategorySnapshot).not.toHaveBeenCalled();
    });

    it('logs a warning and returns the un-enriched roots when the snapshot lookup throws', async () => {
      const failure = new Error('BI bootstrap failed');
      getCachedBatteryIncludedCategorySnapshot.mockRejectedValue(failure);

      await expect(getSegmentNavigationRoots('main', 'en')).resolves.toBe(segmentRoots);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, siteCode: 'main' }),
        expect.stringContaining('snapshot'),
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns an empty forest without touching the snapshot when the scope lookup failed', async () => {
      segmentFilterService.getCategoryScope.mockRejectedValue(new Error('Forbidden'));

      await expect(getSegmentNavigationRoots('main', 'en')).resolves.toEqual([]);

      expect(getCachedBatteryIncludedCategorySnapshot).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNavigationCategoryTreesForMode', () => {
    const segmentRoots = [{ id: 'seg-root', name: 'Segment Root', children: [] }];
    const sharedRoots = [{ id: 'shared-root', name: 'Shared Root', children: [] }];

    beforeEach(() => {
      segmentFilterService.getCategoryScope.mockResolvedValue({
        roots: segmentRoots,
        treeCategoryIds: ['seg-root'],
        assignedCategoryIds: ['seg-root'],
        allowedCategoryIds: ['seg-root'],
      });
      getCachedNavigationCategoryTrees.mockResolvedValue(sharedRoots);
    });

    it('returns the segment roots in assigned mode', async () => {
      await expect(
        getNavigationCategoryTreesForMode('main', 'en', buildContext({ mode: 'assigned' })),
      ).resolves.toEqual(segmentRoots);

      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('main');
      expect(getCachedBatteryIncludedCategorySnapshot).toHaveBeenCalledWith('main', 'en');
      expect(getCachedNavigationCategoryTrees).not.toHaveBeenCalled();
    });

    it('enriches the segment roots with the BI snapshot metadata in assigned mode', async () => {
      getCachedBatteryIncludedCategorySnapshot.mockResolvedValue({
        roots: [],
        byId: {
          'seg-root': {
            id: 'seg-root',
            displayPath: 'Segment Root',
            facetValue: 'Segment Root',
            labelPath: 'Segment Root',
            leafLabel: 'Segment Root',
            publicationAnchorId: 'seg-root',
            count: 5,
            idPath: ['seg-root'],
          },
        },
        byFacetValue: {},
        countsById: {},
      });

      const roots = await getNavigationCategoryTreesForMode('main', 'en', buildContext({ mode: 'assigned' }));

      expect(getBatteryIncludedCategoryMetadata(roots[0])).toMatchObject({ facetValue: 'Segment Root' });
    });

    it.each(['anonymous', 'unsegmented', 'all'] as const)('returns the shared trees in %s mode', async (mode) => {
      await expect(getNavigationCategoryTreesForMode('main', 'en', buildContext({ mode }))).resolves.toBe(sharedRoots);

      expect(getCachedNavigationCategoryTrees).toHaveBeenCalledWith('main', 'en');
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
    });

    it('returns an empty forest instead of rejecting when the scope lookup fails in assigned mode', async () => {
      segmentFilterService.getCategoryScope.mockRejectedValue(new Error('Forbidden'));

      await expect(
        getNavigationCategoryTreesForMode('main', 'en', buildContext({ mode: 'assigned' })),
      ).resolves.toEqual([]);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(getCachedNavigationCategoryTrees).not.toHaveBeenCalled();
    });
  });
});
