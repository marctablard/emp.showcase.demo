'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPunchoutSession } from '@/lib/client/punchout';
import type { PunchoutSession } from '@/platform/services/model/punchout/punchout';

interface UsePunchoutSessionReturn {
  session: PunchoutSession | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePunchoutSession(): UsePunchoutSessionReturn {
  const [session, setSession] = useState<PunchoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPunchoutSession();
      setSession(data);
      if (!data) {
        setError('not_configured');
      }
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : 'Failed to load punchout session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, loading, error, refresh };
}
