'use client';

import { useCallback, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { TrackingInfo } from '@/platform/services/model/tracking';

interface UseTrackingProps {
  orderId: string;
}

interface UseTrackingResult {
  trackingInfo: TrackingInfo | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching order tracking information
 */
export function useTracking({ orderId }: UseTrackingProps): UseTrackingResult {
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrackingInfo = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/tracking`);

      if (!response.ok) {
        throw new Error(`Failed to fetch tracking info: ${response.status}`);
      }

      const data = await response.json();
      setTrackingInfo(data);
    } catch (err) {
      getLogger().error({ err, orderId }, 'Error fetching tracking information');
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [orderId, setTrackingInfo, setError, setLoading]);

  return {
    trackingInfo,
    loading,
    error,
    refetch: fetchTrackingInfo,
  };
}
