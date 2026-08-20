/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
// Import after mock so the hook picks up the mocked useSession.
// eslint-disable-next-line import/first, import/order
import { useCompanyUsers, useOtherCompanyUsers } from './useCompanyUsers';

const mockUseSession = jest.fn();
jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const fetchMock = jest.fn();

function buildUser(id: string, overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    id,
    firstName: 'John',
    lastName: 'Smith',
    contactEmail: `${id}@example.com`,
    active: true,
    groups: [{ id: 'g-1', legalEntityId: 'entity-A', displayName: 'Admin' }],
    createdAt: '2024-12-17T10:00:00.000Z',
    ...overrides,
  };
}

function mockListResponse(items: CompanyUser[], totalCount?: string | null) {
  return {
    ok: true,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-total-count' ? totalCount : null),
    },
    json: async () => items,
    statusText: 'OK',
  } as unknown as Response;
}

describe('useCompanyUsers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
  });

  it('uses one-extra-page fallback when x-total-count is not finite and page is full', async () => {
    const fullPage = [buildUser('U-1'), buildUser('U-2')];
    fetchMock.mockResolvedValue(mockListResponse(fullPage, null));

    const { result } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 2, pageSize: 2 }));

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
    fetchMock.mockResolvedValue(mockListResponse([buildUser('U-1')], 'NaN'));

    const { result } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 2, pageSize: 2 }));

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

  it('sends a two-token search term to the BFF without tokenizing on the client', async () => {
    fetchMock.mockResolvedValue(mockListResponse([buildUser('U-1')], '1'));

    const { result } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 1, pageSize: 5, query: 'John S' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('/api/company-users?');
    expect(requestedUrl).toContain('query=John+S');
  });

  it('refetches page 1 after visiting page 2 when initial page 1 was SSR-reused', async () => {
    const ssrPageOne = [buildUser('SSR-1')];
    const fetchedPageTwo = [buildUser('P2-1')];
    const fetchedPageOne = [buildUser('P1-FRESH-1')];

    fetchMock
      .mockResolvedValueOnce(mockListResponse(fetchedPageTwo, '22'))
      .mockResolvedValueOnce(mockListResponse(fetchedPageOne, '11'));

    const { result, rerender } = renderHook(
      ({ pageNumber }) =>
        useCompanyUsers(ssrPageOne, {
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
    expect(result.current.users).toEqual(ssrPageOne);

    rerender({ pageNumber: 2 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/company-users?pageNumber=2&pageSize=5');
    });
    await waitFor(() => expect(result.current.users).toEqual(fetchedPageTwo));

    rerender({ pageNumber: 1 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/company-users?pageNumber=1&pageSize=5');
    });
    await waitFor(() => expect(result.current.users).toEqual(fetchedPageOne));
  });

  it('refetches when the session legal entity id changes after mount', async () => {
    const entityAUsers = [buildUser('U-ENTITY-A')];
    const entityBUsers = [buildUser('U-ENTITY-B')];

    fetchMock
      .mockResolvedValueOnce(mockListResponse(entityAUsers, null))
      .mockResolvedValueOnce(mockListResponse(entityBUsers, null));

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
    const { result, rerender } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 1, pageSize: 5 }));

    await waitFor(() => expect(result.current.users).toEqual(entityAUsers));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-B' } });
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.users).toEqual(entityBUsers));
  });

  it('does not refetch on rerender when legal entity id is unchanged', async () => {
    fetchMock.mockResolvedValue(mockListResponse([buildUser('U-1')], null));

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
    const { result, rerender } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 1, pageSize: 5 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender();
    rerender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch the selected-LE list when enabled is false', async () => {
    const { result } = renderHook(() => useCompanyUsers(undefined, { pageNumber: 1, pageSize: 5, enabled: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('fetches the selected-LE list when enabled flips from false to true', async () => {
    const users = [buildUser('U-ENABLED')];
    fetchMock.mockResolvedValue(mockListResponse(users, '1'));

    const { result, rerender } = renderHook(
      ({ enabled }) => useCompanyUsers(undefined, { pageNumber: 1, pageSize: 5, enabled }),
      { initialProps: { enabled: false } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.users).toEqual(users));
    expect(fetchMock).toHaveBeenCalledWith('/api/company-users?pageNumber=1&pageSize=5');
  });
});

describe('useOtherCompanyUsers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
  });

  it('does not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useOtherCompanyUsers({ enabled: false, pageNumber: 2, pageSize: 5, sort: 'firstName:asc', query: 'John S' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.pagination).toBeUndefined();
  });

  it('does not fetch when enabled is omitted', async () => {
    renderHook(() => useOtherCompanyUsers({ pageNumber: 1, pageSize: 5 }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('fetches other-company users with page, sort, and query when enabled is true', async () => {
    const otherUsers = [buildUser('OTHER-1')];
    fetchMock.mockResolvedValue(mockListResponse(otherUsers, '22'));

    const { result } = renderHook(() =>
      useOtherCompanyUsers({
        enabled: true,
        pageNumber: 2,
        pageSize: 5,
        sort: 'firstName:asc',
        query: 'John S',
      }),
    );

    await waitFor(() => expect(result.current.users).toEqual(otherUsers));

    expect(result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('/api/company-users/other-companies?');
    expect(requestedUrl).toContain('pageNumber=2');
    expect(requestedUrl).toContain('pageSize=5');
    expect(requestedUrl).toContain('sort=firstName');
    expect(requestedUrl).toContain('query=John+S');
    expect(requestedUrl.startsWith('/api/company-users?')).toBe(false);
    expect(result.current.pagination).toEqual({
      pageNumber: 2,
      pageSize: 5,
      totalPages: 5,
      totalItems: 22,
    });
    expect(result.current.error).toBeNull();
  });

  it('sets pagination from x-total-count rather than items.length', async () => {
    fetchMock.mockResolvedValue(mockListResponse([buildUser('OTHER-PAGE')], '22'));

    const { result } = renderHook(() => useOtherCompanyUsers({ enabled: true, pageNumber: 1, pageSize: 5 }));

    await waitFor(() => expect(result.current.users).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pagination).toEqual({
      pageNumber: 1,
      pageSize: 5,
      totalPages: 5,
      totalItems: 22,
    });
  });

  it('fetches when enabled flips from false to true', async () => {
    const otherUsers = [buildUser('OTHER-2')];
    fetchMock.mockResolvedValue(mockListResponse(otherUsers, '1'));

    const { result, rerender } = renderHook(
      ({ enabled }) => useOtherCompanyUsers({ enabled, pageNumber: 1, pageSize: 5 }),
      {
        initialProps: { enabled: false },
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.users).toEqual(otherUsers));
    expect(fetchMock).toHaveBeenCalledWith('/api/company-users/other-companies?pageNumber=1&pageSize=5');
  });

  it('refetches when pageNumber changes', async () => {
    fetchMock.mockResolvedValue(mockListResponse([buildUser('OTHER-PAGE')], '10'));

    const { rerender } = renderHook(
      ({ pageNumber }) => useOtherCompanyUsers({ enabled: true, pageNumber, pageSize: 5 }),
      { initialProps: { pageNumber: 1 } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/company-users/other-companies?pageNumber=1&pageSize=5');

    rerender({ pageNumber: 2 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/company-users/other-companies?pageNumber=2&pageSize=5');
  });

  it('does not call the first-table list endpoint', async () => {
    fetchMock.mockResolvedValue(mockListResponse([buildUser('OTHER-3')], '1'));

    const { result } = renderHook(() =>
      useOtherCompanyUsers({ enabled: true, pageNumber: 1, pageSize: 5, query: 'Ada' }),
    );

    await waitFor(() => expect(result.current.users).toHaveLength(1));

    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('/api/company-users/other-companies?');
    expect(requestedUrl.startsWith('/api/company-users?')).toBe(false);
    expect(requestedUrl).not.toMatch(/\/api\/company-users\?/);
  });
});
