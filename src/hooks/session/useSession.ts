'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  const sessionStore = useSessionStore();
  const session = sessionStore.session;
  const loading = sessionStore.loading;
  const hasAttemptedRecovery = useRef(false);

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

  useEffect(() => {
    if (session === undefined) {
      hasAttemptedRecovery.current = false;
      sessionStore.fetchSession();
      return;
    }

    const needsRecovery = session === null || !session.siteCode || !session.currency;
    if (needsRecovery && !hasAttemptedRecovery.current && !loading) {
      hasAttemptedRecovery.current = true;
      sessionStore.fetchSession();
      return;
    }

    if (!needsRecovery) {
      hasAttemptedRecovery.current = false;
    }
  }, [session, sessionStore, loading]);

  const setLanguage = async (language: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionLanguage(language));
  };

  const setCurrency = async (currency: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionCurrency(currency));
  };

  const setCountry = async (country: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionCountry(country));
  };

  const setSite = async (site: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionSite(site));
  };

  const setRegion = async (region: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionRegion(region));
  };

  const setCompany = async (legalEntityId: string): Promise<boolean> => {
    return runSessionMutation(() => updateSessionCompany(legalEntityId));
  };

  const refreshSession = async (): Promise<Session | null | undefined> => {
    sessionStore.setLoading(true);
    const { session: updatedSession, hasError } = await fetchSessionWithStatus();
    if (!hasError) {
      sessionStore.setSession(updatedSession);
    } else if (sessionStore.session === undefined) {
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
