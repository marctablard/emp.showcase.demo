'use client';

import { useCallback, useEffect } from 'react';
import {
  fetchCurrentSession,
  updateSessionCompany,
  updateSessionCountry,
  updateSessionCurrency,
  updateSessionLanguage,
  updateSessionRegion,
  updateSessionSite,
} from '@/lib/client/session';
import type { Session } from '@/platform/services/model/session/session';
import { useSessionStore } from '@/providers/StoreProvider';

/**
 * Hook for managing session data
 * Provides methods to get and update session information
 */
export function useSession() {
  // Get state from the store
  const sessionStore = useSessionStore();
  const session = sessionStore.session;
  const loading = sessionStore.loading;

  const fetchSessionWithStatus = useCallback(async (): Promise<{ session: Session | null; hasError: boolean }> => {
    try {
      const nextSession = await fetchCurrentSession(true);
      return { session: nextSession, hasError: false };
    } catch (_error) {
      return { session: null, hasError: true };
    }
  }, []);

  const runSessionMutation = useCallback(
    async (mutation: () => Promise<boolean>): Promise<boolean> => {
      if (!sessionStore.tryAcquireMutationLock()) {
        return false;
      }
      sessionStore.setLoading(true);
      try {
        const success = await mutation();
        if (success) {
          const { session: updatedSession, hasError } = await fetchSessionWithStatus();
          if (hasError) {
            // Treat mutation as incomplete when we cannot confirm updated session state.
            return false;
          }
          sessionStore.setSession(updatedSession);
        }
        return success;
      } finally {
        sessionStore.setLoading(false);
        sessionStore.releaseMutationLock();
      }
    },
    [fetchSessionWithStatus, sessionStore],
  );

  const fetchSession = useCallback(async () => {
    sessionStore.setLoading(true);
    const { session: sessionData, hasError } = await fetchSessionWithStatus();
    if (!hasError) {
      sessionStore.setSession(sessionData);
    } else if (sessionStore.session === undefined) {
      // Stop initial refetch loop when the first session request fails.
      sessionStore.setSession(null);
    }
    sessionStore.setLoading(false);
  }, [fetchSessionWithStatus, sessionStore]);
  // Fetch session data on initial load
  useEffect(() => {
    if (sessionStore.session !== undefined || sessionStore.loading) {
      return;
    }
    fetchSession();
  }, [sessionStore.session, sessionStore.loading, fetchSession]);

  /**
   * Update the session language
   */
  const setLanguage = async (language: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionLanguage(language));
  };

  /**
   * Update the session currency
   */
  const setCurrency = async (currency: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionCurrency(currency));
  };

  /**
   * Update the session country
   */
  const setCountry = async (country: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionCountry(country));
  };

  /**
   * Update the session site
   */
  const setSite = async (site: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionSite(site));
  };

  /**
   * Update the session region
   */
  const setRegion = async (region: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionRegion(region));
  };

  /**
   * Update the session company (legal entity)
   */
  const setCompany = async (legalEntityId: string): Promise<boolean> => {
    sessionStore.setLoading(true);
    const success = await updateSessionCompany(legalEntityId);
    if (success) {
      const updatedSession = await fetchCurrentSession();
      sessionStore.setSession(updatedSession);
    }
    sessionStore.setLoading(false);
    return success;
  };

  /**
   * Manually refresh the session data
   */
  const refreshSession = async (): Promise<Session | null | undefined> => {
    sessionStore.setLoading(true);
    const { session: updatedSession, hasError } = await fetchSessionWithStatus();
    if (!hasError) {
      sessionStore.setSession(updatedSession);
    } else if (sessionStore.session === undefined) {
      // Keep refresh behavior consistent with initial fetch fallback.
      sessionStore.setSession(null);
    }
    sessionStore.setLoading(false);
    return hasError ? sessionStore.session : updatedSession;
  };

  return {
    session,
    loading,
    setLanguage,
    setCurrency,
    setCountry,
    setSite,
    setRegion,
    setCompany,
    refreshSession,
  };
}

export type UseSessionReturn = ReturnType<typeof useSession>;
