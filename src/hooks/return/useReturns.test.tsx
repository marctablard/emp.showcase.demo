/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Return } from '@/platform/services/model/return';
// eslint-disable-next-line import/first, import/order
import { useReturns } from './useReturns';

const mockUseSession = jest.fn();
jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockFetchReturnsPage = jest.fn();

jest.mock('@/lib/client/returns', () => ({
  fetchReturnsPage: (...args: unknown[]) => mockFetchReturnsPage(...args),
}));

async function renderReturnsHook<Result, Props>(hook: (props: Props) => Result, options?: { initialProps: Props }) {
  const view = renderHook(hook, options);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

function buildReturn(id: string): Return {
  return {
    id,
    status: 'PENDING',
    received: false,
    isExpired: false,
    orders: [],
  };
}

describe('useReturns', () => {
  beforeEach(() => {
    mockFetchReturnsPage.mockReset();
    mockFetchReturnsPage.mockResolvedValue({ items: [], totalCount: 0 });
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
  });

  it('reuses SSR-provided initialReturns for the default page-one, no-query/no-sort load without refetching', async () => {
    const initialReturns = [buildReturn('ssr-1')];

    const { result } = await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 1 }));

    expect(result.current.returns).toEqual(initialReturns);
    expect(result.current.totalCount).toBeUndefined();
    expect(mockFetchReturnsPage).not.toHaveBeenCalled();
  });

  it('fetches from the client when pageNumber is not 1, even with initialReturns present', async () => {
    const initialReturns = [buildReturn('ssr-1')];
    mockFetchReturnsPage.mockResolvedValue({ items: [buildReturn('page-2')], totalCount: 10 });

    const { result } = await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 2, pageSize: 5 }));

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(5, 2, undefined, undefined, false);
    });
    await waitFor(() => expect(result.current.returns).toEqual([buildReturn('page-2')]));
    expect(result.current.totalCount).toBe(10);
  });

  it('fetches from the client when a query is present, even on page 1', async () => {
    const initialReturns = [buildReturn('ssr-1')];
    mockFetchReturnsPage.mockResolvedValue({ items: [buildReturn('search-hit')], totalCount: 1 });

    await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 1, query: 'id:~(abc)' }));

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(undefined, 1, 'id:~(abc)', undefined, false);
    });
  });

  it('reuses SSR-provided initialReturns for the canonical default sort request without refetching', async () => {
    const initialReturns = [buildReturn('ssr-1')];

    const { result } = await renderReturnsHook(() =>
      useReturns(initialReturns, {
        pageNumber: 1,
        pageSize: 5,
        sort: 'metadata.createdAt:DESC',
        initialTotalCount: 77,
        initialRequest: {
          pageNumber: 1,
          pageSize: 5,
          sort: 'metadata.createdAt:DESC',
          query: undefined,
        },
      }),
    );

    expect(result.current.returns).toEqual(initialReturns);
    expect(result.current.totalCount).toBe(77);
    expect(mockFetchReturnsPage).not.toHaveBeenCalled();
  });

  it('fetches from the client when a non-canonical sort is present on page 1', async () => {
    const initialReturns = [buildReturn('ssr-1')];

    await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 1, sort: 'metadata.createdAt:ASC' }));

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(undefined, 1, undefined, 'metadata.createdAt:ASC', false);
    });
  });

  it('force-refreshes on mount even when SSR page-one data could otherwise be reused', async () => {
    const initialReturns = [buildReturn('ssr-1')];
    mockFetchReturnsPage.mockResolvedValue({ items: [buildReturn('fresh')], totalCount: 1 });

    await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 1, forceRefreshOnMount: true }));

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(undefined, 1, undefined, undefined, true);
    });
  });

  it('fetches from the client when there is no initialReturns at all', async () => {
    mockFetchReturnsPage.mockResolvedValue({ items: [buildReturn('client-only')], totalCount: 1 });

    const { result } = await renderReturnsHook(() => useReturns(undefined, { pageNumber: 1 }));

    await waitFor(() => expect(result.current.returns).toEqual([buildReturn('client-only')]));
    expect(mockFetchReturnsPage).toHaveBeenCalledTimes(1);
  });

  it('surfaces a fetch error via the error state and clears loading', async () => {
    mockFetchReturnsPage.mockRejectedValue(new Error('network down'));

    const { result } = await renderReturnsHook(() => useReturns(undefined, { pageNumber: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network down');
  });

  it('refreshReturns triggers a forced client refetch', async () => {
    const initialReturns = [buildReturn('ssr-1')];
    mockFetchReturnsPage.mockResolvedValue({ items: [buildReturn('refreshed')], totalCount: 1 });

    const { result } = await renderReturnsHook(() => useReturns(initialReturns, { pageNumber: 1 }));
    expect(mockFetchReturnsPage).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refreshReturns();
    });

    expect(mockFetchReturnsPage).toHaveBeenCalledWith(undefined, 1, undefined, undefined, true);
    await waitFor(() => expect(result.current.returns).toEqual([buildReturn('refreshed')]));
  });

  it('only forwards the safe upstream sort fields configured by the caller (no unapproved query/sort params)', async () => {
    await renderReturnsHook(() =>
      useReturns(undefined, { pageNumber: 1, sort: 'approvalStatus:DESC', query: 'id:~(123)' }),
    );

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(undefined, 1, 'id:~(123)', 'approvalStatus:DESC', false);
    });

    const [, , , sortArg] = mockFetchReturnsPage.mock.calls[0];
    expect(['metadata.createdAt', 'approvalStatus'].some((field) => sortArg.startsWith(field))).toBe(true);
  });

  it('refetches page 1 after visiting page 2 when initial page 1 was SSR-reused', async () => {
    const ssrPageOne = [buildReturn('ssr-1')];
    const fetchedPageTwo = [buildReturn('page-2')];
    const fetchedPageOne = [buildReturn('page-1-fresh')];

    mockFetchReturnsPage
      .mockResolvedValueOnce({ items: fetchedPageTwo, totalCount: 22 })
      .mockResolvedValueOnce({ items: fetchedPageOne, totalCount: 11 });

    const { result, rerender } = await renderReturnsHook(
      ({ pageNumber }) =>
        useReturns(ssrPageOne, {
          pageNumber,
          pageSize: 5,
          initialTotalCount: 11,
          initialRequest: {
            pageNumber: 1,
            pageSize: 5,
            sort: undefined,
            query: undefined,
          },
        }),
      { initialProps: { pageNumber: 1 } },
    );

    expect(mockFetchReturnsPage).not.toHaveBeenCalled();
    expect(result.current.returns).toEqual(ssrPageOne);

    await act(async () => {
      rerender({ pageNumber: 2 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(5, 2, undefined, undefined, false);
    });
    await waitFor(() => expect(result.current.returns).toEqual(fetchedPageTwo));

    await act(async () => {
      rerender({ pageNumber: 1 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(5, 1, undefined, undefined, false);
    });
    await waitFor(() => expect(result.current.returns).toEqual(fetchedPageOne));
    expect(result.current.returns).not.toEqual(fetchedPageTwo);
  });

  it('force-refreshes when the session legal entity id changes after mount', async () => {
    const initialReturns = [buildReturn('ssr-1')];
    mockFetchReturnsPage.mockResolvedValueOnce({ items: [buildReturn('entity-b')], totalCount: 1 });

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
    const { result, rerender } = await renderReturnsHook(() =>
      useReturns(initialReturns, {
        pageNumber: 1,
        pageSize: 5,
        initialRequest: { pageNumber: 1, pageSize: 5, sort: undefined, query: undefined },
      }),
    );

    expect(mockFetchReturnsPage).not.toHaveBeenCalled();
    expect(result.current.returns).toEqual(initialReturns);

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-B' } });
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchReturnsPage).toHaveBeenCalledWith(5, 1, undefined, undefined, true);
    });
    await waitFor(() => expect(result.current.returns).toEqual([buildReturn('entity-b')]));
  });
});
