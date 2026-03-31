import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { EmporixCategoryTree } from '@/platform/integrations/emporix/model';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CategoryFilterExpansionCacheService } from './CategoryFilterExpansionCacheService';

describe('CategoryFilterExpansionCacheService', () => {
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

  function tree(id: string, subcategories: EmporixCategoryTree[] = []): EmporixCategoryTree {
    return { id, name: {}, subcategories } as EmporixCategoryTree;
  }

  it('calls Emporix once for the same id set within TTL', async () => {
    const search = jest.fn().mockResolvedValue([tree('root', [tree('child')])]);
    const categoryApi = { searchCategoryTreesForCategoryIds: search } as unknown as EmporixCategoryApi;
    const svc = new CategoryFilterExpansionCacheService(categoryApi, logger);

    const a = await svc.expandCategoryIdsForProductSearch(['root']);
    const b = await svc.expandCategoryIdsForProductSearch(['root']);
    expect(a).toEqual(b);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(['root']);
  });

  it('uses distinct cache entries for different id sets', async () => {
    const search = jest
      .fn()
      .mockResolvedValueOnce([tree('a')])
      .mockResolvedValueOnce([tree('b')]);
    const categoryApi = { searchCategoryTreesForCategoryIds: search } as unknown as EmporixCategoryApi;
    const svc = new CategoryFilterExpansionCacheService(categoryApi, logger);

    await svc.expandCategoryIdsForProductSearch(['a']);
    await svc.expandCategoryIdsForProductSearch(['b']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('calls Emporix again after TTL expiry', async () => {
    const search = jest.fn().mockResolvedValue([tree('x')]);
    const categoryApi = { searchCategoryTreesForCategoryIds: search } as unknown as EmporixCategoryApi;
    const svc = new CategoryFilterExpansionCacheService(categoryApi, logger);

    await svc.expandCategoryIdsForProductSearch(['x']);
    jest.advanceTimersByTime(11 * 60 * 1000);
    await svc.expandCategoryIdsForProductSearch(['x']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('does not cache Emporix failures; returns raw ids', async () => {
    const search = jest.fn().mockRejectedValue(new Error('boom'));
    const categoryApi = { searchCategoryTreesForCategoryIds: search } as unknown as EmporixCategoryApi;
    const svc = new CategoryFilterExpansionCacheService(categoryApi, logger);

    await expect(svc.expandCategoryIdsForProductSearch(['u1'])).resolves.toEqual(['u1']);
    await expect(svc.expandCategoryIdsForProductSearch(['u1'])).resolves.toEqual(['u1']);
    expect(search).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });
});
