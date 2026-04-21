'use client';

import { createContext, useContext } from 'react';
import type { StoreApi } from 'zustand';
import { create, useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { fetchCurrentSession } from '@/lib/client/session';
import type { Session } from '@/platform/services/model/session/session';

export interface SessionState {
  session: Session | null | undefined;
  loading: boolean;
}

export interface SessionActions {
  setSession: (session: Session | null | undefined) => void;
  setLoading: (loading: boolean) => void;
  fetchSession: () => Promise<Session | null>;
  tryAcquireMutationLock: () => boolean;
  releaseMutationLock: () => void;
  isMutationInFlight: () => boolean;
  reset: () => void;
}

export type SessionStore = SessionState & SessionActions;

const defaultState: SessionState = {
  session: undefined,
  loading: false,
};

export const createSessionStore = (initState: SessionState = defaultState) => {
  let mutationInFlight = false;
  let _fetchPromise: Promise<Session | null> | null = null;

  return create<SessionStore>()(
    subscribeWithSelector((set, get) => ({
      ...initState,
      setSession: (session: Session | null | undefined) => {
        devSyncLog('session-store: setSession', {
          siteCode: session?.siteCode,
          currency: session?.currency,
          cartId: session?.cartId,
        });
        set({ session });
      },
      setLoading: (loading: boolean) => set({ loading }),
      fetchSession: async (): Promise<Session | null> => {
        if (_fetchPromise) return _fetchPromise;
        const promise = (async () => {
          set({ loading: true });
          try {
            const session = await fetchCurrentSession(true);
            set({ session, loading: false });
            devSyncLog('session-store: fetchSession completed', {
              siteCode: session?.siteCode,
              currency: session?.currency,
              cartId: session?.cartId,
            });
            return session;
          } catch {
            if (get().session === undefined) set({ session: null });
            set({ loading: false });
            return null;
          }
        })();
        _fetchPromise = promise;
        void promise.finally(() => {
          if (_fetchPromise === promise) _fetchPromise = null;
        });
        return promise;
      },
      tryAcquireMutationLock: () => {
        if (mutationInFlight) {
          return false;
        }
        mutationInFlight = true;
        return true;
      },
      releaseMutationLock: () => {
        mutationInFlight = false;
      },
      isMutationInFlight: () => mutationInFlight,
      reset: () => set(defaultState),
    })),
  );
};

export const SessionStoreContext = createContext<StoreApi<SessionStore> | null>(null);

export function useSessionStore<T>(selector: (state: SessionStore) => T): T {
  const store = useContext(SessionStoreContext);
  if (!store) {
    throw new Error('useSessionStore must be used within a SessionStoreContext.Provider');
  }
  return useStore(store, selector);
}
