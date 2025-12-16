import { Layout, Layouts } from 'react-grid-layout';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  // Dashboard layout data
  layouts: Layouts;
  loading: boolean;
  error: Error | null;
}

interface ConfigActions {
  setLayouts: (layouts: Layouts) => void;
  getLayouts: () => Layouts;
  resetLayouts: () => void;
  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
}

type ConfigStore = ConfigState & ConfigActions;

// Default layout configuration for the dashboard
const defaultLayouts: Layouts = {
  // Large screens (≥1280px) - 4 columns
  lg: [
    { i: 'ai-helper', x: 0, y: 0, w: 2, h: 12 },
    { i: 'weather', x: 2, y: 0, w: 1, h: 12 },
    { i: 'notification', x: 0, y: 1, w: 1, h: 16 },
    { i: 'ticket', x: 2, y: 1, w: 2, h: 16 },
    { i: 'orders', x: 0, y: 2, w: 2, h: 19 },
    { i: 'invoices', x: 0, y: 3, w: 2, h: 19 },
    { i: 'documents', x: 0, y: 4, w: 3, h: 6 },
  ],
  /*
  TODO: Add missing layouts
  // Medium screens (≥996px) - 3 columns
  lg: [
    // Top row - small stat cards
    { i: 'revenue', x: 0, y: 0, w: 1, h: 1 },
    { i: 'orders', x: 1, y: 0, w: 1, h: 1 },
    { i: 'approvals', x: 2, y: 0, w: 1, h: 1 },

    // Second row - larger content cards
    { i: 'budget', x: 0, y: 1, w: 1, h: 2 },
    { i: 'inbox', x: 1, y: 1, w: 1, h: 2 },
    { i: 'weather', x: 2, y: 1, w: 1, h: 2 },
    { i: 'recent-orders', x: 0, y: 4, w: 3, h: 2, minH: 2, minW: 2 },
    { i: 'solar-output', x: 0, y: 2, w: 3, h: 2, minH: 2, minW: 2 },
  ],

  // Small screens (≥768px) - 2 columns
  md: [
    // Stat cards in first row
    { i: 'revenue', x: 0, y: 0, w: 1, h: 1 },
    { i: 'orders', x: 1, y: 0, w: 1, h: 1 },
    { i: 'approvals', x: 0, y: 1, w: 2, h: 1 },
    { i: 'weather', x: 0, y: 2, w: 2, h: 1 },

    // Content cards stacked
    { i: 'budget', x: 0, y: 3, w: 2, h: 2 },
    { i: 'inbox', x: 0, y: 5, w: 2, h: 2 },

    { i: 'recent-orders', x: 0, y: 8, w: 2, h: 2, minH: 2, minW: 2 },
    { i: 'solar-output', x: 0, y: 6, w: 2, h: 2, minH: 2, minW: 2 },
  ],

  // Extra small screens (≥480px) - 1 column
  sm: [
    // All cards stacked vertically
    { i: 'revenue', x: 0, y: 0, w: 1, h: 1 },
    { i: 'orders', x: 0, y: 1, w: 1, h: 1 },
    { i: 'approvals', x: 0, y: 2, w: 1, h: 1 },
    { i: 'weather', x: 0, y: 3, w: 1, h: 2 },
    { i: 'budget', x: 0, y: 5, w: 1, h: 2 },
    { i: 'inbox', x: 0, y: 7, w: 1, h: 2 },
    { i: 'recent-orders', x: 0, y: 9, w: 1, h: 2, minH: 2 },
    { i: 'solar-output', x: 0, y: 8, w: 1, h: 2, minH: 2 },
  ],
  */
};

// Create the dashboard store with persistence
export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      layouts: defaultLayouts,
      loading: false,
      error: null,
      setLayouts: (layouts: Layouts) => set({ layouts }),
      getLayouts: () => get().layouts,
      resetLayouts: () => set({ layouts: defaultLayouts }),
      setLoading: (loading: boolean) => set({ loading }),
      getLoading: () => get().loading,
    }),
    {
      name: 'dashboard-layout', // localStorage key
    },
  ),
);

interface LocalDashboardState {
  items: React.ReactNode[];
  currentLayout: Layout[] | null;
  currentBreakpoint: string;
  renderedLayout: Layout[] | null;
  setRenderedLayout: (layout: Layout[]) => void;
}

// Create a local store to handle layout changes without causing re-renders
export const useLocalDashboardStore = create<LocalDashboardState>((set) => ({
  items: [] as React.ReactNode[],
  currentLayout: null,
  currentBreakpoint: 'lg',
  renderedLayout: null,
  setRenderedLayout: (layout: Layout[]) => set({ renderedLayout: layout }),
}));

export const findCardLayout = (cardKey: string, layout: Layout[]) => {
  const layoutItem = layout.find((item) => item.i === cardKey);
  return {
    cols: layoutItem?.w || 1,
    rows: layoutItem?.h || 1,
  };
};
