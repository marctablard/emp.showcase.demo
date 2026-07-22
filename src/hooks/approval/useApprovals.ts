'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Approval,
  ApprovalCreateRequest,
  ApprovalId,
  ApprovalPermittedRequest,
  ApprovalPermittedResponse,
  ApprovalUser,
} from '@/platform/services/model/approval';

interface UseApprovalsPagination {
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface UseApprovalsOptions {
  /** 1-based page number to request from the server. */
  pageNumber?: number;
  pageSize?: number;
  /** Raw Emporix sort expression, e.g. `metadata.modifiedAt:desc`. */
  sort?: string;
  /** Raw Emporix `q` query expression. */
  query?: string;
  /** Total item count seeded from SSR, used to compute pagination before the first client fetch. */
  initialTotalCount?: number;
  /** The exact params SSR used to fetch `initialApprovals`, used to decide if the initial client fetch can be skipped. */
  initialRequest?: {
    pageNumber?: number;
    pageSize?: number;
    sort?: string;
    query?: string;
  };
}

interface UseApprovalsReturn {
  approvals: Approval[];
  loading: boolean;
  error: Error | null;
  pagination?: UseApprovalsPagination;
  createApproval: (approval: ApprovalCreateRequest) => Promise<ApprovalId>;
  checkApprovalPermitted: (request: ApprovalPermittedRequest) => Promise<ApprovalPermittedResponse>;
  searchApprovalUsers: (resourceType: string, resourceId: string, action: string) => Promise<ApprovalUser[]>;
  refreshApprovals: () => Promise<void>;
}

/**
 * Hook for fetching a server-authoritative page of approvals, plus approval
 * create/permission/search helpers used by checkout and quote approval flows.
 * @param initialApprovals Optional initial approvals data (from SSR)
 * @param options Optional pagination/sort/query params and SSR-reuse metadata
 */
export function useApprovals(initialApprovals?: Approval[], options: UseApprovalsOptions = {}): UseApprovalsReturn {
  const { pageNumber, pageSize, sort, query, initialTotalCount, initialRequest } = options;

  const canReuseInitialData =
    !!initialApprovals &&
    (pageNumber ?? 1) === (initialRequest?.pageNumber ?? 1) &&
    pageSize === initialRequest?.pageSize &&
    sort === initialRequest?.sort &&
    query === initialRequest?.query;

  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals || []);
  const [loading, setLoading] = useState<boolean>(!canReuseInitialData);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<UseApprovalsPagination | undefined>(() => {
    if (initialTotalCount === undefined) {
      return undefined;
    }
    const size = pageSize || 60;
    return {
      pageNumber: pageNumber ?? 1,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(initialTotalCount / size)),
      totalItems: initialTotalCount,
    };
  });

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const urlParams = new URLSearchParams();
      if (pageNumber !== undefined) {
        urlParams.append('pageNumber', pageNumber.toString());
      }
      if (pageSize !== undefined) {
        urlParams.append('pageSize', pageSize.toString());
      }
      if (sort !== undefined) {
        urlParams.append('sort', sort);
      }
      if (query !== undefined) {
        urlParams.append('query', query);
      }

      const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';
      const response = await fetch(`/api/approval${queryString}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to fetch approvals: ${response.statusText}`);
      }

      const totalCountHeader = response.headers.get('x-total-count');
      const parsedTotalCount = totalCountHeader ? Number.parseInt(totalCountHeader, 10) : Number.NaN;
      const data: Approval[] = await response.json();
      setApprovals(data);

      const size = pageSize || 60;
      const totalItems = Number.isFinite(parsedTotalCount) ? parsedTotalCount : data.length;
      setPagination({
        pageNumber: pageNumber ?? 1,
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

  const refreshApprovals = useCallback(async () => {
    await fetchApprovals();
  }, [fetchApprovals]);

  // Skip only the initial fetch when SSR data matches the exact params it was fetched with.
  useEffect(() => {
    if (!canReuseInitialData) {
      fetchApprovals();
    }
  }, [canReuseInitialData, fetchApprovals]);

  const createApproval = useCallback(
    async (approvalData: ApprovalCreateRequest): Promise<ApprovalId> => {
      try {
        setLoading(true);
        const response = await fetch('/api/approval', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(approvalData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to create approval: ${response.statusText}`);
        }

        const data = await response.json();
        refreshApprovals();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refreshApprovals],
  );

  const checkApprovalPermitted = useCallback(
    async (request: ApprovalPermittedRequest): Promise<ApprovalPermittedResponse> => {
      try {
        setLoading(true);
        const response = await fetch('/api/approval/permitted', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to check approval permission: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const searchApprovalUsers = useCallback(
    async (resourceType: string, resourceId: string, action: string): Promise<ApprovalUser[]> => {
      try {
        setLoading(true);
        // Using the GET endpoint format from the client approval.ts
        const response = await fetch(
          `/api/approval/users?resourceType=${resourceType}&resourceId=${resourceId}&action=${action}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to search approval users: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    approvals,
    loading,
    error,
    pagination,
    createApproval,
    checkApprovalPermitted,
    searchApprovalUsers,
    refreshApprovals,
  };
}
