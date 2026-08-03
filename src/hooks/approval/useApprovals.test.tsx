/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { useApprovals } from './useApprovals';

const fetchMock = jest.fn();

function buildApproval(id: string): Approval {
  return {
    id,
    resourceType: 'QUOTE',
    action: 'CHECKOUT',
    status: 'PENDING',
    resource: { id: `resource-${id}` },
    requestor: {
      userId: `requestor-${id}`,
      firstName: 'Requester',
      lastName: 'One',
      email: 'requestor@example.com',
    },
    approver: {
      userId: `approver-${id}`,
      firstName: 'Approver',
      lastName: 'One',
    },
    createdAt: '2026-01-01T10:00:00.000Z',
    modifiedAt: '2026-01-01T10:00:00.000Z',
  };
}

describe('useApprovals', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('uses one-extra-page fallback when x-total-count is not finite and page is full', async () => {
    const fullPage = [buildApproval('A-1'), buildApproval('A-2')];

    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: () => null,
      },
      json: async () => fullPage,
      statusText: 'OK',
    } as unknown as Response);

    const { result } = renderHook(() => useApprovals(undefined, { pageNumber: 2, pageSize: 2 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pagination).toEqual({
      pageNumber: 2,
      pageSize: 2,
      totalPages: 3,
      totalItems: 6,
    });
  });

  it('uses partial-page fallback when x-total-count is not finite and page is partial', async () => {
    const partialPage = [buildApproval('A-1')];

    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-total-count' ? 'NaN' : null),
      },
      json: async () => partialPage,
      statusText: 'OK',
    } as unknown as Response);

    const { result } = renderHook(() => useApprovals(undefined, { pageNumber: 2, pageSize: 2 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pagination).toEqual({
      pageNumber: 2,
      pageSize: 2,
      totalPages: 2,
      totalItems: 3,
    });
  });

  it('refetches page 1 after visiting page 2 when initial page 1 was SSR-reused', async () => {
    const ssrPageOne = [buildApproval('SSR-1')];
    const fetchedPageTwo = [buildApproval('P2-1')];
    const fetchedPageOne = [buildApproval('P1-FRESH-1')];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-total-count' ? '22' : null) },
        json: async () => fetchedPageTwo,
        statusText: 'OK',
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-total-count' ? '11' : null) },
        json: async () => fetchedPageOne,
        statusText: 'OK',
      } as unknown as Response);

    const { result, rerender } = renderHook(
      ({ pageNumber }) =>
        useApprovals(ssrPageOne, {
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.approvals).toEqual(ssrPageOne);

    rerender({ pageNumber: 2 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/approval?pageNumber=2&pageSize=5');
    });
    await waitFor(() => expect(result.current.approvals).toEqual(fetchedPageTwo));

    rerender({ pageNumber: 1 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/approval?pageNumber=1&pageSize=5');
    });
    await waitFor(() => expect(result.current.approvals).toEqual(fetchedPageOne));
    expect(result.current.approvals).not.toEqual(fetchedPageTwo);
  });
});
