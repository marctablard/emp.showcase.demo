'use client';

import { useCallback, useEffect, useState } from 'react';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { requiresApproval as apiRequiresApproval } from '@/lib/client/approval';

/**
 * Interface for the return value of the useApprovalCheck hook
 */
interface UseApprovalCheckReturn {
  requiresApproval: boolean;
  loading: boolean;
  error: Error | null;
  setCartId: (cartId: string | undefined) => void;

  checkApproval: () => Promise<boolean>;
}

/**
 * Hook for checking if a cart requires approval
 * @param cartId The ID of the cart to check
 */
export function useApprovalCheckout(initialCartId?: string): UseApprovalCheckReturn {
  const [cartId, setCartId] = useState<string | undefined>(initialCartId);
  const [approvalRequired, setApprovalRequired] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Without a cart there is nothing to approve. Derived during render rather than reset from
  // an effect, so no cascading render is needed to clear a stale value.
  const requiresApproval = cartId ? approvalRequired : false;

  const checkApproval = useCallback(async (): Promise<boolean> => {
    if (!cartId) return false;

    try {
      setLoading(true);
      setError(null);

      const result = await apiRequiresApproval(cartId);
      setApprovalRequired(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setApprovalRequired(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  // Check approval requirement when cartId changes
  useEffect(() => {
    if (!cartId) {
      return;
    }
    return startEffectTask(checkApproval);
  }, [cartId, checkApproval]);

  return {
    requiresApproval,
    loading,
    error,
    setCartId,
    checkApproval,
  };
}

export default useApprovalCheckout;
