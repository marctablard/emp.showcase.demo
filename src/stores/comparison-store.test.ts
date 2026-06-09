import { MAX_COMPARISON_PRODUCTS, createComparisonStore } from './comparison-store';
import type { ComparisonStore } from './comparison-store';

// Provide an in-memory localStorage for zustand persist middleware
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('comparison-store', () => {
  let store: ReturnType<typeof createComparisonStore>;
  let getState: () => ComparisonStore;

  beforeEach(() => {
    localStorageMock.clear();
    store = createComparisonStore({ productIds: [] });
    getState = store.getState;
  });

  describe('addProductId', () => {
    it('adds a product ID and returns true', () => {
      const result = getState().addProductId('p1');
      expect(result).toBe(true);
      expect(getState().productIds).toHaveLength(1);
      expect(getState().productIds[0]).toBe('p1');
    });

    it('adds up to MAX_COMPARISON_PRODUCTS', () => {
      for (let i = 1; i <= MAX_COMPARISON_PRODUCTS; i++) {
        const result = getState().addProductId(`p${i}`);
        expect(result).toBe(true);
      }
      expect(getState().productIds).toHaveLength(MAX_COMPARISON_PRODUCTS);
    });

    it('rejects the 5th product and returns false', () => {
      for (let i = 1; i <= MAX_COMPARISON_PRODUCTS; i++) {
        getState().addProductId(`p${i}`);
      }
      const result = getState().addProductId('p5');
      expect(result).toBe(false);
      expect(getState().productIds).toHaveLength(MAX_COMPARISON_PRODUCTS);
    });

    it('rejects duplicate product ID and returns false', () => {
      getState().addProductId('p1');
      const result = getState().addProductId('p1');
      expect(result).toBe(false);
      expect(getState().productIds).toHaveLength(1);
    });
  });

  describe('removeProduct', () => {
    it('removes an existing product by id', () => {
      getState().addProductId('p1');
      getState().addProductId('p2');
      getState().removeProduct('p1');
      expect(getState().productIds).toHaveLength(1);
      expect(getState().productIds[0]).toBe('p2');
    });

    it('does nothing when removing a non-existent id', () => {
      getState().addProductId('p1');
      getState().removeProduct('nonexistent');
      expect(getState().productIds).toHaveLength(1);
    });
  });

  describe('isInComparison', () => {
    it('returns true for an added product', () => {
      getState().addProductId('p1');
      expect(getState().isInComparison('p1')).toBe(true);
    });

    it('returns false for a product not in comparison', () => {
      expect(getState().isInComparison('p1')).toBe(false);
    });
  });

  describe('clearComparison', () => {
    it('empties all product IDs', () => {
      getState().addProductId('p1');
      getState().addProductId('p2');
      getState().clearComparison();
      expect(getState().productIds).toHaveLength(0);
    });
  });

  describe('getCount', () => {
    it('returns 0 for empty store', () => {
      expect(getState().getCount()).toBe(0);
    });

    it('returns correct count after adding products', () => {
      getState().addProductId('p1');
      getState().addProductId('p2');
      expect(getState().getCount()).toBe(2);
    });

    it('returns correct count after removing a product', () => {
      getState().addProductId('p1');
      getState().addProductId('p2');
      getState().removeProduct('p1');
      expect(getState().getCount()).toBe(1);
    });
  });

  describe('storageKey parameter', () => {
    it('uses provided storageKey as persist name', () => {
      const customStore = createComparisonStore(undefined, 'comparison:mysite:user123');
      customStore.getState().addProductId('p1');
      expect(localStorageMock.getItem('comparison:mysite:user123')).not.toBeNull();
    });
  });
});
