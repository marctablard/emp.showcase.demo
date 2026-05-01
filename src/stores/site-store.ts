'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Site } from '@/platform/services/model/common/site';

export interface SiteState {
  // Site data
  site: Site | null | undefined;
  availableSites: Site[] | undefined;
  loading: boolean;
  error: Error | null;
}

interface SiteActions {
  setSite: (site: Site | null) => void;
  getSite: () => Site | null | undefined;
  setAvailableSites: (sites: Site[]) => void;
  getAvailableSites: () => Site[] | undefined;
  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
  /** Full teardown — drops everything including the cached `availableSites` list. Use on logout / provider unmount. */
  reset: () => void;
  /**
   * Partial reset used on site switches: drops only the active site payload so `useSite` refetches,
   * but preserves `availableSites` for the rest of the browser session (avoids redundant `GET /api/site/`).
   */
  resetSite: () => void;
}
export type SiteStore = SiteState & SiteActions;

const defaultState: SiteState = {
  site: undefined,
  availableSites: undefined,
  loading: false,
  error: null,
};

export const createSiteStore = (initState: SiteState = defaultState) => {
  return create<SiteStore>()(
    subscribeWithSelector((set, get) => ({
      ...initState,
      setSite: (site: Site | null | undefined) => set({ site }),
      getSite: () => get().site,
      setAvailableSites: (sites: Site[]) => set({ availableSites: sites }),
      getAvailableSites: () => get().availableSites,
      setLoading: (loading: boolean) => set({ loading }),
      getLoading: () => get().loading,
      reset: () => set(defaultState),
      resetSite: () => set({ site: undefined, loading: false, error: null }),
    })),
  );
};
