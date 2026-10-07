'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { useSession } from '@/hooks/session/useSession';
import { fetchCompanyUsers, fetchOtherCompanyUsers } from '@/lib/client/user-management';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';

const DEFAULT_PAGE_SIZE = USERS_PER_PAGE;

interface UseCompanyUsersPagination {
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface UseCompanyUsersOptions {
  /** 1-based page number to request from the server. */
  pageNumber?: number;
  pageSize?: number;
  /** Raw sort expression, e.g. `metadataCreatedAt:desc`. */
  sort?: string;
  /** Raw name-or-email search term sent to the BFF (tokenization is server-side). */
  query?: string;
  /** Total item count seeded from SSR, used to compute pagination before the first client fetch. */
  initialTotalCount?: number;
  /** The exact params SSR used to fetch `initialUsers`, used to decide if the initial client fetch can be skipped. */
  initialRequest?: {
    pageNumber?: number;
    pageSize?: number;
    sort?: string;
    query?: string;
  };
  /**
   * When false, skip the selected-LE list fetch (for example while the combined
   * Admin-LE checkbox view is showing). Defaults to true. Combined-view UI can
   * pass `false` so `GET /api/company-users` is not requested until the checkbox
   * is unchecked again.
   */
  enabled?: boolean;
}

interface UseCompanyUsersReturn {
  users: CompanyUser[];
  loading: boolean;
  error: Error | null;
  pagination?: UseCompanyUsersPagination;
  refreshUsers: () => Promise<void>;
}

/**
 * Hook for fetching a server-authoritative page of company users for the selected legal entity.
 * No Zustand store — list state is local, matching `useApprovals`.
 */
export function useCompanyUsers(
  initialUsers?: CompanyUser[],
  options: UseCompanyUsersOptions = {},
): UseCompanyUsersReturn {
  const { pageNumber, pageSize, sort, query, initialTotalCount, initialRequest, enabled = true } = options;
  const { session } = useSession();
  const legalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  const canReuseInitialData =
    !!initialUsers &&
    (pageNumber ?? 1) === (initialRequest?.pageNumber ?? 1) &&
    pageSize === initialRequest?.pageSize &&
    sort === initialRequest?.sort &&
    query === initialRequest?.query;

  const [users, setUsers] = useState<CompanyUser[]>(initialUsers || []);
  const [loading, setLoading] = useState<boolean>(enabled && !canReuseInitialData);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<UseCompanyUsersPagination | undefined>(() => {
    if (initialTotalCount === undefined) {
      return undefined;
    }
    const size = pageSize || DEFAULT_PAGE_SIZE;
    return {
      pageNumber: pageNumber ?? 1,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(initialTotalCount / size)),
      totalItems: initialTotalCount,
    };
  });

  const fetchUsers = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const size = pageSize || DEFAULT_PAGE_SIZE;
      const result = await fetchCompanyUsers(pageNumber, size, sort, query);
      setUsers(result.items);
      const currentPage = pageNumber ?? 1;
      let totalItems: number;
      if (result.totalCount !== undefined) {
        totalItems = result.totalCount;
      } else if (result.items.length === size) {
        totalItems = (currentPage + 1) * size;
      } else {
        totalItems = (currentPage - 1) * size + result.items.length;
      }
      setPagination({
        pageNumber: currentPage,
        pageSize: size,
        totalPages: Math.max(1, Math.ceil(totalItems / size)),
        totalItems,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [enabled, pageNumber, pageSize, sort, query]);

  const refreshUsers = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  const skipInitialFetchRef = useRef(canReuseInitialData);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    return startEffectTask(fetchUsers);
  }, [enabled, fetchUsers]);

  const previousLegalEntityIdRef = useRef(legalEntityId);
  useEffect(() => {
    if (previousLegalEntityIdRef.current === legalEntityId) {
      return;
    }
    previousLegalEntityIdRef.current = legalEntityId;
    if (!enabled) {
      return;
    }
    return startEffectTask(fetchUsers);
  }, [enabled, legalEntityId, fetchUsers]);

  return {
    users,
    loading,
    error,
    pagination,
    refreshUsers,
  };
}

interface UseOtherCompanyUsersOptions {
  /** When false, the other-companies endpoint is not requested. */
  enabled?: boolean;
  /** 1-based page number to request from the server. */
  pageNumber?: number;
  pageSize?: number;
  /** Raw sort expression, e.g. `metadataCreatedAt:desc`. */
  sort?: string;
  /** Raw name-or-email search term sent to the BFF (tokenization is server-side). */
  query?: string;
}

interface UseOtherCompanyUsersReturn {
  users: CompanyUser[];
  loading: boolean;
  error: Error | null;
  pagination?: UseCompanyUsersPagination;
  refreshUsers: () => Promise<void>;
}

/**
 * Lazy-load combined Admin-LE assignment rows from GET /api/company-users/other-companies.
 * Does not fetch until `enabled` is true. Pagination is derived from `x-total-count`
 * with the same shape as `useCompanyUsers` so the list pager can reuse that contract.
 */
export function useOtherCompanyUsers({
  enabled = false,
  pageNumber,
  pageSize,
  sort,
  query,
}: UseOtherCompanyUsersOptions = {}): UseOtherCompanyUsersReturn {
  const { session } = useSession();
  const legalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<UseCompanyUsersPagination | undefined>();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const size = pageSize || DEFAULT_PAGE_SIZE;
      const result = await fetchOtherCompanyUsers(pageNumber, size, sort, query);
      setUsers(result.items);
      const currentPage = pageNumber ?? 1;
      let totalItems: number;
      if (result.totalCount !== undefined) {
        totalItems = result.totalCount;
      } else if (result.items.length === size) {
        totalItems = (currentPage + 1) * size;
      } else {
        totalItems = (currentPage - 1) * size + result.items.length;
      }
      setPagination({
        pageNumber: currentPage,
        pageSize: size,
        totalPages: Math.max(1, Math.ceil(totalItems / size)),
        totalItems,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, pageSize, sort, query]);

  const refreshUsers = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return startEffectTask(fetchUsers);
  }, [enabled, legalEntityId, fetchUsers]);

  return {
    users,
    loading,
    error,
    pagination,
    refreshUsers,
  };
}
