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
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Session } from '@/platform/services/model/session/session';
import { useCartStore, useSessionStore } from '@/providers/StoreProvider';

export interface SetCurrencyResult {
  success: boolean;
  cartCurrencyBlocked?: boolean;
}

/** Hook for reading and mutating session data. */
export function useSession() {
  const sessionStore = useSessionStore();
  const cartStore = useCartStore();
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
    async (
      mutation: () => Promise<boolean>,
      afterCommit?: (updatedSession: Session | null) => Promise<void>,
    ): Promise<boolean> => {
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
          if (afterCommit) {
            // Runs while the mutation lock is still held so any cart writes here are treated as
            // orchestrator-driven (mirroring `performSiteSwitch` → `validateSite`). Cross-store
            // subscribers that gate on `isMutationInFlight()` stay suppressed; this hook is the
            // single authoritative caller. afterCommit failures must not fail the mutation —
            // the PUT already succeeded, so we log and continue so `finally` releases the lock.
            try {
              await afterCommit(updatedSession);
            } catch (err) {
              getLogger().error({ err }, 'Session mutation afterCommit failed');
            }
          }
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

  const setCurrency = async (currency: string): Promise<SetCurrencyResult> => {
    let reconciledCart: Cart | null | undefined;
    let cartIncludedInResponse = false;
    let cartCurrencyBlocked = false;
    const success = await runSessionMutation(async () => {
      const result = await updateSessionCurrency(currency);
      if (result.success && 'cart' in result) {
        reconciledCart = result.cart ?? null;
        cartIncludedInResponse = true;
      }
      if (!result.success && result.cartCurrencyBlocked) {
        cartCurrencyBlocked = true;
      }
      return result.success;
    });
    if (success && cartIncludedInResponse) {
      cartStore.setCurrentCart(reconciledCart ?? null);
    }
    return { success, ...(cartCurrencyBlocked ? { cartCurrencyBlocked: true } : {}) };
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
    // `store-synchronizer`'s `unsubLegalEntity` subscriber is suppressed while the mutation lock
    // is held, so the cart refetch that normally reacts to a `legalEntityId` change never runs
    // during `setCompany`. Mirror `performSiteSwitch`'s pattern: explicitly drive the cart
    // reconciliation here, under the lock, using the session-refetched (authoritative) value.
    return runSessionMutation(
      () => updateSessionCompany(legalEntityId),
      async (updatedSession) => {
        const rawLegalEntityId = updatedSession?.legalEntityId;
        const normalized = typeof rawLegalEntityId === 'string' ? rawLegalEntityId.trim() : '';
        await cartStore.validateLegalEntity(normalized === '' ? undefined : normalized);
      },
    );
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
