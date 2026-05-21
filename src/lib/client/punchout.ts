import { getLogger } from '@/lib/logger/use-logger-client';
import type { PunchoutSession } from '@/platform/services/model/punchout/punchout';

export async function getPunchoutSession(): Promise<PunchoutSession | null> {
  try {
    const response = await fetch('/api/punchout/session', { cache: 'no-store' });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch punchout session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error }, 'Failed to get punchout session');
    return null;
  }
}
