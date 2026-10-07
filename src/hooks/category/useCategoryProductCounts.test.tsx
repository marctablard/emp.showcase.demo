import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchCategoryProductCount } from '@/lib/client/category';
import { useCategoryProductCounts } from './useCategoryProductCounts';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

jest.mock('@/lib/client/category', () => ({
  fetchCategoryProductCount: jest.fn(),
}));

const fetchMock = fetchCategoryProductCount as jest.MockedFunction<typeof fetchCategoryProductCount>;

describe('useCategoryProductCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns seeded initial counts without firing requests', async () => {
    const { result } = renderHook(() => useCategoryProductCounts({ 'cat-1': 42 }));

    expect(result.current.counts).toEqual({ 'cat-1': 42 });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      result.current.requestCounts(['cat-1']);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads counts for requested ids and deduplicates repeat requests', async () => {
    fetchMock.mockImplementation(async (id: string) => (id === 'cat-a' ? 5 : 10));

    const { result } = renderHook(() => useCategoryProductCounts());

    act(() => {
      result.current.requestCounts(['cat-a', 'cat-b', 'cat-a']);
    });

    await waitFor(() => {
      expect(result.current.counts).toEqual({ 'cat-a': 5, 'cat-b': 10 });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('cat-a');
    expect(fetchMock).toHaveBeenCalledWith('cat-b');

    act(() => {
      result.current.requestCounts(['cat-a', 'cat-b']);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const resolvers: Array<() => void> = [];

    fetchMock.mockImplementation(
      (_id: string) =>
        new Promise<number>((resolve) => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          resolvers.push(() => {
            concurrent -= 1;
            resolve(1);
          });
        }),
    );

    const { result } = renderHook(() => useCategoryProductCounts(undefined, { concurrency: 2 }));

    act(() => {
      result.current.requestCounts(['a', 'b', 'c', 'd']);
    });

    await waitFor(() => {
      expect(resolvers.length).toBe(2);
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);

    await act(async () => {
      resolvers.shift()?.();
      resolvers.shift()?.();
    });

    await waitFor(() => {
      expect(resolvers.length).toBe(2);
    });

    await act(async () => {
      resolvers.shift()?.();
      resolvers.shift()?.();
    });

    await waitFor(() => {
      expect(Object.keys(result.current.counts)).toHaveLength(4);
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('ignores empty / whitespace ids', () => {
    const { result } = renderHook(() => useCategoryProductCounts());

    act(() => {
      result.current.requestCounts(['', '   ']);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.counts).toEqual({});
  });
});
