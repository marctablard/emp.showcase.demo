'use client';

import { createContext, useContext } from 'react';
import { StoreApi, create, useStore } from 'zustand';
import { Session } from '@/platform/services/model/session/session';

export interface SessionState {
  session: Session | null | undefined;
  loading: boolean;
}

export interface SessionActions {
  setSession: (session: Session | null | undefined) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type SessionStore = SessionState & SessionActions;

const defaultState: SessionState = {
  session: undefined,
  loading: false,
};

export const createSessionStore = (initState: SessionState = defaultState) => {
  return create<SessionStore>()((set) => ({
    ...initState,
    setSession: (session: Session | null | undefined) => set({ session }),
    setLoading: (loading: boolean) => set({ loading }),
    reset: () => set(defaultState),
  }));
};

export const SessionStoreContext = createContext<StoreApi<SessionStore> | null>(null);

export function useSessionStore<T>(selector: (state: SessionStore) => T): T {
  const store = useContext(SessionStoreContext);
  if (!store) {
    throw new Error('useSessionStore must be used within a SessionStoreContext.Provider');
  }
  return useStore(store, selector);
}
