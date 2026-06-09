'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Approval,
  ApprovalCreateRequest,
  ApprovalId,
  ApprovalPermittedRequest,
  ApprovalPermittedResponse,
  ApprovalUser,
} from '@/platform/services/model/approval';

interface UseApprovalsReturn {
  approvals: Approval[];
  loading: boolean;
  error: Error | null;
  createApproval: (approval: ApprovalCreateRequest) => Promise<ApprovalId>;
  checkApprovalPermitted: (request: ApprovalPermittedRequest) => Promise<ApprovalPermittedResponse>;
  searchApprovalUsers: (resourceType: string, resourceId: string, action: string) => Promise<ApprovalUser[]>;
  refreshApprovals: () => Promise<void>;
  filterApprovals: (filter: Partial<Approval>) => Promise<void>;
}

/**
 * Hook for interacting with approval lists and filtering
 * @param initialApprovals Optional initial approvals data
 * @param initialFilter Optional initial filter to apply
 * @param query Optional search query string (e.g. "id:~(searchterm)")
 */
export function useApprovals(
  initialApprovals?: Approval[],
  initialFilter?: Partial<Approval>,
  query?: string,
): UseApprovalsReturn {
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals || []);
  const [filter, setFilter] = useState<Partial<Approval> | undefined>(initialFilter);
  const [loading, setLoading] = useState<boolean>(!initialApprovals);
  const [error, setError] = useState<Error | null>(null);

  const fetchApprovals = useCallback(
    async (filterParams?: Partial<Approval>) => {
      try {
        setLoading(true);

        let url = '/api/approval';
        const urlParams = new URLSearchParams();

        // Build q= DSL query from filter params and/or explicit query
        const queryParts: string[] = [];

        if (filterParams?.status) {
          queryParts.push(`status:${filterParams.status}`);
        }

        if (query) {
          queryParts.push(query);
        }

        if (queryParts.length > 0) {
          urlParams.append('query', queryParts.join(' '));
        }

        if (urlParams.toString()) {
          url += `?${urlParams.toString()}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to fetch approvals: ${response.statusText}`);
        }

        const data = await response.json();
        setApprovals(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const filterApprovals = useCallback(
    async (newFilter: Partial<Approval>) => {
      setFilter(newFilter);
      await fetchApprovals(newFilter);
    },
    [fetchApprovals],
  );

  const refreshApprovals = useCallback(async () => {
    await fetchApprovals(filter);
  }, [fetchApprovals, filter]);

  // Load approvals on initial render if not provided, or re-fetch when query changes
  const isFirstRender = useRef(!!initialApprovals && !query);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchApprovals(filter);
  }, [fetchApprovals, filter]);

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
    createApproval,
    checkApprovalPermitted,
    searchApprovalUsers,
    refreshApprovals,
    filterApprovals,
  };
}
