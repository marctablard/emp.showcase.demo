import type { EmporixCatalogApi } from '@/platform/integrations/emporix/catalog/EmporixCatalogApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CatalogPublishedRootCategoryService } from './CatalogPublishedRootCategoryService';

describe('CatalogPublishedRootCategoryService', () => {
  const logger: LoggerService = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as LoggerService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('unions categoryIds from all catalogs for the site', async () => {
    const catalogApi: EmporixCatalogApi = {
      getCatalogs: jest.fn().mockResolvedValue({
        items: [{ categoryIds: ['a', 'b'] }, { categoryIds: ['b', 'c'] }],
        page: 1,
        size: 100,
        total: 2,
      }),
      getCatalog: jest.fn(),
    } as unknown as EmporixCatalogApi;

    const svc = new CatalogPublishedRootCategoryService(catalogApi, logger);
    await expect(svc.getRootCategoryIdsForSite('main')).resolves.toEqual(['a', 'b', 'c']);
    expect(catalogApi.getCatalogs).toHaveBeenCalledTimes(1);
  });

  it('returns cached ids within TTL without calling API again', async () => {
    const getCatalogs = jest.fn().mockResolvedValue({
      items: [{ categoryIds: ['x'] }],
      page: 1,
      size: 100,
      total: 1,
    });
    const catalogApi = { getCatalogs, getCatalog: jest.fn() } as unknown as EmporixCatalogApi;

    const svc = new CatalogPublishedRootCategoryService(catalogApi, logger);
    await svc.getRootCategoryIdsForSite('fw-site');
    await svc.getRootCategoryIdsForSite('fw-site');
    expect(getCatalogs).toHaveBeenCalledTimes(1);
  });

  it('returns empty array and logs when getCatalogs throws', async () => {
    const catalogApi: EmporixCatalogApi = {
      getCatalogs: jest.fn().mockRejectedValue(new Error('network')),
      getCatalog: jest.fn(),
    } as unknown as EmporixCatalogApi;

    const svc = new CatalogPublishedRootCategoryService(catalogApi, logger);
    await expect(svc.getRootCategoryIdsForSite('main')).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });
});
