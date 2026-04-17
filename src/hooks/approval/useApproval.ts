'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';

interface UseApprovalReturn {
  approval: Approval | null;
  loading: boolean;
  error: Error | null;
  updateApprovalStatus: (status: ApprovalStatus) => Promise<void>;
  updateApproverComment: (comment: string) => Promise<void>;
  updateRequestorComment: (comment: string) => Promise<void>;
  deleteApproval: () => Promise<void>;
  refreshApproval: () => Promise<void>;
}

/**
 * Hook for interacting with a single approval
 * @param approvalId The ID of the approval to interact with
 * @param initialApproval Optional initial approval data
 */
export function useApproval(approvalId: string, initialApproval?: Approval | null): UseApprovalReturn {
  const [approval, setApproval] = useState<Approval | null>(initialApproval || null);
  const [loading, setLoading] = useState<boolean>(!initialApproval);
  const [error, setError] = useState<Error | null>(null);

  const fetchApproval = useCallback(async () => {
    if (!approvalId) return null;

    try {
      setLoading(true);
      const response = await fetch(`/api/approval/${approvalId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setApproval(null);
          return null;
        }
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to get approval: ${response.statusText}`);
      }

      const data = await response.json();
      setApproval(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  const refreshApproval = useCallback(async () => {
    await fetchApproval();
  }, [fetchApproval]);

  // Load approval on initial render if not provided
  useEffect(() => {
    if (!initialApproval && approvalId) {
      fetchApproval();
    }
  }, [initialApproval, approvalId, fetchApproval]);

  const updateApprovalStatus = useCallback(
    async (status: ApprovalStatus): Promise<void> => {
      if (!approvalId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/approval/${approvalId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to update approval status: ${response.statusText}`);
        }

        // Refresh the approval data after update
        await fetchApproval();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [approvalId, fetchApproval],
  );

  const updateApproverComment = useCallback(
    async (approverComment: string): Promise<void> => {
      if (!approvalId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/approval/${approvalId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approverComment: approverComment,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to update approver comment: ${response.statusText}`);
        }

        // Refresh the approval data after update
        await fetchApproval();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [approvalId, fetchApproval],
  );

  const updateRequestorComment = useCallback(
    async (comment: string): Promise<void> => {
      if (!approvalId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/approval/${approvalId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestorComment: comment,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to update requestor comment: ${response.statusText}`);
        }

        // Refresh the approval data after update
        await fetchApproval();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [approvalId, fetchApproval],
  );

  const deleteApproval = useCallback(async (): Promise<void> => {
    if (!approvalId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/approval/${approvalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete approval: ${response.statusText}`);
      }

      setApproval(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  return {
    approval,
    loading,
    error,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    deleteApproval,
    refreshApproval,
  };
}
