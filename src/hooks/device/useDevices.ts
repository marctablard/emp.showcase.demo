import { useCallback, useEffect, useState } from 'react';
import { useLogger } from '@/hooks/common/useLogger';
import { fetchDevices } from '@/lib/client/devices';
import type { Device } from '@/types/device';

interface UseDevicesResult {
  devices: Device[];
  loading: boolean;
  error: Error | null;
  refreshDevices: () => Promise<void>;
}

export function useDevices(initialDevices?: Device[]): UseDevicesResult {
  const logger = useLogger();
  const [devices, setDevices] = useState<Device[]>(initialDevices || []);
  const [loading, setLoading] = useState<boolean>(!initialDevices);
  const [error, setError] = useState<Error | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedDevices = await fetchDevices();
      setDevices(fetchedDevices);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      logger.error({ err: errorObj }, 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (!initialDevices) {
      loadDevices();
    }
  }, [initialDevices, loadDevices]);

  const refreshDevices = useCallback(async () => {
    await loadDevices();
  }, [loadDevices]);

  return { devices, loading, error, refreshDevices };
}
