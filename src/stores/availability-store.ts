import { create } from 'zustand/react';
import { StockAvailability } from '@/platform/services/stock/StockService';

// re-export for convenience
export { useAvailabilityStore } from '@/providers/StoreProvider';

export type AvailabilityState = {
  availabilities: {
    [key: string]: StockAvailability;
  };
  // Track loading state for each product
  loading: {
    [key: string]: boolean;
  };
  // Track error state for each product
  errors: {
    [key: string]: Error | null;
  };
};

export type AvailabilityActions = {
  getAvailability: (productId: string, site?: string) => StockAvailability | null;
  getAvailabilities: (productIds: string[], site?: string) => Record<string, StockAvailability>;
  setAvailability: (availability: StockAvailability) => void;
  setAvailabilities: (availabilities: StockAvailability[]) => void;
  setLoading: (productId: string, isLoading: boolean) => void;
  setError: (productId: string, error: Error | null) => void;
  clearAvailability: (productId: string) => void;
  clearAllAvailabilities: () => void;
};

export type AvailabilityStore = AvailabilityState & AvailabilityActions;

const defaultState: AvailabilityState = {
  availabilities: {},
  loading: {},
  errors: {},
};

export const createAvailabilityStore = (initState: AvailabilityState = defaultState) => {
  return create<AvailabilityStore>()((set, get) => ({
    ...initState,

    getAvailability: (productId: string, site?: string) => {
      const state = get();
      // Use site in the key if provided
      const key = site ? `${productId}_${site}` : productId;
      return state.availabilities[key] || null;
    },

    getAvailabilities: (productIds: string[], site?: string) => {
      const state = get();
      const result: Record<string, StockAvailability> = {};

      productIds.forEach((productId) => {
        const key = site ? `${productId}_${site}` : productId;
        const availability = state.availabilities[key];
        if (availability) {
          result[productId] = availability;
        }
      });

      return result;
    },

    setAvailability: (availability: StockAvailability) => {
      set((state) => {
        const key = availability.productId;
        return {
          availabilities: {
            ...state.availabilities,
            [key]: availability,
          },
          loading: {
            ...state.loading,
            [key]: false,
          },
          errors: {
            ...state.errors,
            [key]: null,
          },
        };
      });
    },

    setAvailabilities: (availabilities: StockAvailability[]) => {
      set((state) => {
        const newAvailabilities = { ...state.availabilities };
        const newLoading = { ...state.loading };
        const newErrors = { ...state.errors };

        availabilities.forEach((availability) => {
          const key = availability.productId;
          newAvailabilities[key] = availability;
          newLoading[key] = false;
          newErrors[key] = null;
        });

        return {
          availabilities: newAvailabilities,
          loading: newLoading,
          errors: newErrors,
        };
      });
    },

    setLoading: (productId: string, isLoading: boolean) => {
      set((state) => ({
        loading: {
          ...state.loading,
          [productId]: isLoading,
        },
      }));
    },

    setError: (productId: string, error: Error | null) => {
      set((state) => ({
        errors: {
          ...state.errors,
          [productId]: error,
        },
        loading: {
          ...state.loading,
          [productId]: false,
        },
      }));
    },

    clearAvailability: (productId: string) => {
      set((state) => {
        const newAvailabilities = { ...state.availabilities };
        const newLoading = { ...state.loading };
        const newErrors = { ...state.errors };

        delete newAvailabilities[productId];
        delete newLoading[productId];
        delete newErrors[productId];

        return {
          availabilities: newAvailabilities,
          loading: newLoading,
          errors: newErrors,
        };
      });
    },

    clearAllAvailabilities: () => {
      set({
        availabilities: {},
        loading: {},
        errors: {},
      });
    },
  }));
};
