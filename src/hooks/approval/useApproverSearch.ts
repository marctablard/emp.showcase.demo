'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/ui/useToast';
import { searchApprovalUsers } from '@/lib/client/approval';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { ApprovalAction, ApprovalResourceType, ApprovalUser } from '@/platform/services/model/approval';

interface UseApproverSearchProps {
  resourceType?: ApprovalResourceType;
  resourceId?: string;
  action?: ApprovalAction;
  enabled?: boolean;
}

interface UseApproverSearchResult {
  approvers: ApprovalUser[] | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for searching users who can approve a specific resource
 */
export function useApproverSearch({
  resourceType = 'CART',
  resourceId = '',
  action = 'CHECKOUT',
  enabled = false,
}: UseApproverSearchProps = {}): UseApproverSearchResult {
  const [approvers, setApprovers] = useState<ApprovalUser[] | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const t = useTranslations('checkout.approval');
  const { toast } = useToast();

  const fetchApprovers = useCallback(async () => {
    if (!resourceId) return;

    setLoading(true);
    setError(null);

    try {
      const fetchedApprovers = await searchApprovalUsers(resourceType, resourceId, action);
      setApprovers(fetchedApprovers);
    } catch (err) {
      getLogger().error({ err }, 'Error fetching approvers');
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setApprovers([]);
      setError(errorObj);

      toast({
        title: t('errorFetchingApprovers'),
        description: t('errorFetchingApproversDescription'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId, action, t, toast]);

  useEffect(() => {
    if (!enabled || !resourceId) {
      return;
    }

    void fetchApprovers();
  }, [enabled, resourceId, fetchApprovers]);

  return {
    approvers,
    loading,
    error,
    refetch: fetchApprovers,
  };
}
