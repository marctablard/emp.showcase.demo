import type { PunchoutSession } from '../model/punchout/punchout';

export interface PunchoutService {
  /**
   * Load the configured punchout session from the PUNCHOUT_SESSIONS custom entity.
   * Uses NEXT_PUNCHOUT_SESSION_ID when no explicit id is provided.
   */
  getPunchoutSession(sessionId?: string): Promise<PunchoutSession | null>;
}
