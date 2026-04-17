'use client';

import { create } from 'zustand';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Session } from '@/platform/services/model/session/session';

export interface SessionState {
  session: Session | null | undefined;
  loading: boolean;
}

interface SessionActions {
  setSession: (session: Session | null | undefined) => void;
  getSession: () => Session | null | undefined;
  setLanguage: (language: string) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setCountry: (country: string) => Promise<void>;
  setSite: (site: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
  reset: () => void;
}

export type SessionStore = SessionState & SessionActions;

const defaultState: SessionState = {
  session: undefined,
  loading: false,
};

export const createSessionStore = (initState: SessionState = defaultState) => {
  return create<SessionStore>()((set, get) => ({
    ...initState,
    setSession: (session: Session | null | undefined) => set({ session }),
    getSession: () => get().session,
    setLanguage: async (language: string) => {
      set({ loading: true });
      try {
        await fetch('/api/session/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language }),
        });
        // Refresh session data after update
        const response = await fetch('/api/session');
        const updatedSession = await response.json();
        set({ session: updatedSession, loading: false });
      } catch (error) {
        getLogger().error({ err: error }, 'Error setting language');
        set({ loading: false });
      }
    },
    setCurrency: async (currency: string) => {
      set({ loading: true });
      try {
        await fetch('/api/session/currency', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency }),
        });
        // Refresh session data after update
        const response = await fetch('/api/session');
        const updatedSession = await response.json();
        set({ session: updatedSession, loading: false });
      } catch (error) {
        getLogger().error({ err: error }, 'Error setting currency');
        set({ loading: false });
      }
    },
    setCountry: async (country: string) => {
      set({ loading: true });
      try {
        await fetch('/api/session/country', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country }),
        });
        // Refresh session data after update
        const response = await fetch('/api/session');
        const updatedSession = await response.json();
        set({ session: updatedSession, loading: false });
      } catch (error) {
        getLogger().error({ err: error }, 'Error setting country');
        set({ loading: false });
      }
    },
    setSite: async (site: string) => {
      set({ loading: true });
      try {
        await fetch('/api/session/site', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site }),
        });
        // Refresh session data after update
        const response = await fetch('/api/session');
        const updatedSession = await response.json();
        set({ session: updatedSession, loading: false });
      } catch (error) {
        getLogger().error({ err: error }, 'Error setting site');
        set({ loading: false });
      }
    },
    setLoading: (loading: boolean) => set({ loading }),
    getLoading: () => get().loading,
    reset: () => set(defaultState),
  }));
};
