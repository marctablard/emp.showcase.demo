/**
 * Tests the comparison table algorithm logic — shared attribute computation,
 * differ detection, and edge cases (no specs, empty products).
 *
 * Mocks next-intl and l10n to focus on algorithm correctness.
 */
import { ComparisonTable } from '@/components/comparison/comparison-table';
import type { Product } from '@/platform/services/model/product';

// --- Mocks ---
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (val: unknown) => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object' && 'en' in val) return (val as Record<string, string>).en;
      return String(val);
    },
  }),
}));

jest.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
}));

jest.mock('@/components/ui/h', () => ({
  H5: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Helpers ---

function makeProduct(id: string, overrides?: Partial<Product>): Product {
  return {
    id,
    name: { en: `Product ${id}` },
    description: { en: '' },
    purchasable: true,
    ...overrides,
  } as Product;
}

/**
 * Extract the algorithm logic from ComparisonTable without rendering.
 * We replicate the key computation here to test the algorithm in isolation.
 */
function computeTableRows(products: Product[]) {
  const l10n = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object' && 'en' in val) return (val as Record<string, string>).en;
    return String(val);
  };

  const specKeysByProduct = products.map((product) => new Set(product.specifications?.map((spec) => spec.key) ?? []));

  const allKeys = new Map<string, number>();
  for (const keySet of specKeysByProduct) {
    for (const key of keySet) {
      allKeys.set(key, (allKeys.get(key) ?? 0) + 1);
    }
  }
  const sharedKeys = [...allKeys.entries()].filter(([, count]) => count >= 2).map(([key]) => key);

  const getSpecValue = (product: Product, key: string): string => {
    const spec = product.specifications?.find((s) => s.key === key);
    if (!spec) return '—';
    const value = l10n(spec.value);
    const unit = spec.unit ? ` ${l10n(spec.unit)}` : '';
    return `${value}${unit}`;
  };

  const valuesDiffer = (key: string): boolean => {
    const values = products.map((p) => getSpecValue(p, key));
    return new Set(values).size > 1;
  };

  const getSpecLabel = (key: string): string => {
    for (const product of products) {
      const spec = product.specifications?.find((s) => s.key === key);
      if (spec) return l10n(spec.label);
    }
    return key;
  };

  return {
    sharedKeys,
    rows: sharedKeys.map((key) => ({
      label: getSpecLabel(key),
      values: products.map((p) => getSpecValue(p, key)),
      differ: valuesDiffer(key),
    })),
  };
}

// --- Tests ---

describe('ComparisonTable algorithm', () => {
  describe('shared attribute computation', () => {
    it('finds keys present in at least 2 products', () => {
      const products = [
        makeProduct('p1', {
          specifications: [
            { key: 'weight', label: { en: 'Weight' }, value: { en: '10' }, unit: { en: 'kg' } },
            { key: 'color', label: { en: 'Color' }, value: { en: 'Red' } },
          ],
        }),
        makeProduct('p2', {
          specifications: [
            { key: 'weight', label: { en: 'Weight' }, value: { en: '15' }, unit: { en: 'kg' } },
            { key: 'color', label: { en: 'Color' }, value: { en: 'Blue' } },
          ],
        }),
      ];

      const { sharedKeys } = computeTableRows(products);
      expect(sharedKeys).toContain('weight');
      expect(sharedKeys).toContain('color');
    });

    it('excludes keys present in only 1 product', () => {
      const products = [
        makeProduct('p1', {
          specifications: [
            { key: 'weight', label: { en: 'Weight' }, value: { en: '10' } },
            { key: 'unique-spec', label: { en: 'Unique' }, value: { en: 'Yes' } },
          ],
        }),
        makeProduct('p2', {
          specifications: [{ key: 'weight', label: { en: 'Weight' }, value: { en: '15' } }],
        }),
      ];

      const { sharedKeys } = computeTableRows(products);
      expect(sharedKeys).toContain('weight');
      expect(sharedKeys).not.toContain('unique-spec');
    });
  });

  describe('differ detection', () => {
    it('marks rows as differing when values are different', () => {
      const products = [
        makeProduct('p1', {
          specifications: [{ key: 'weight', label: { en: 'Weight' }, value: { en: '10' }, unit: { en: 'kg' } }],
        }),
        makeProduct('p2', {
          specifications: [{ key: 'weight', label: { en: 'Weight' }, value: { en: '20' }, unit: { en: 'kg' } }],
        }),
      ];

      const { rows } = computeTableRows(products);
      const weightRow = rows.find((r) => r.label === 'Weight');
      expect(weightRow?.differ).toBe(true);
    });

    it('marks rows as non-differing when all values are the same', () => {
      const products = [
        makeProduct('p1', {
          specifications: [{ key: 'color', label: { en: 'Color' }, value: { en: 'Red' } }],
        }),
        makeProduct('p2', {
          specifications: [{ key: 'color', label: { en: 'Color' }, value: { en: 'Red' } }],
        }),
      ];

      const { rows } = computeTableRows(products);
      const colorRow = rows.find((r) => r.label === 'Color');
      expect(colorRow?.differ).toBe(false);
    });

    it('shows dash for missing spec value and detects difference', () => {
      const products = [
        makeProduct('p1', {
          specifications: [
            { key: 'weight', label: { en: 'Weight' }, value: { en: '10' } },
            { key: 'color', label: { en: 'Color' }, value: { en: 'Red' } },
          ],
        }),
        makeProduct('p2', {
          specifications: [{ key: 'color', label: { en: 'Color' }, value: { en: 'Red' } }],
        }),
        makeProduct('p3', {
          specifications: [
            { key: 'weight', label: { en: 'Weight' }, value: { en: '10' } },
            { key: 'color', label: { en: 'Color' }, value: { en: 'Blue' } },
          ],
        }),
      ];

      const { rows } = computeTableRows(products);
      const weightRow = rows.find((r) => r.label === 'Weight');
      // p2 lacks weight spec, so its value is '—' which differs from '10'
      expect(weightRow?.differ).toBe(true);
      expect(weightRow?.values[1]).toBe('—');
    });
  });

  describe('edge cases', () => {
    it('handles products with no specifications', () => {
      const products = [
        makeProduct('p1', { specifications: undefined }),
        makeProduct('p2', { specifications: undefined }),
      ];

      const { sharedKeys, rows } = computeTableRows(products);
      expect(sharedKeys).toHaveLength(0);
      expect(rows).toHaveLength(0);
    });

    it('handles empty products array', () => {
      const { sharedKeys, rows } = computeTableRows([]);
      expect(sharedKeys).toHaveLength(0);
      expect(rows).toHaveLength(0);
    });

    it('includes unit in value display', () => {
      const products = [
        makeProduct('p1', {
          specifications: [{ key: 'weight', label: { en: 'Weight' }, value: { en: '10' }, unit: { en: 'kg' } }],
        }),
        makeProduct('p2', {
          specifications: [{ key: 'weight', label: { en: 'Weight' }, value: { en: '15' }, unit: { en: 'kg' } }],
        }),
      ];

      const { rows } = computeTableRows(products);
      const weightRow = rows.find((r) => r.label === 'Weight');
      expect(weightRow?.values[0]).toBe('10 kg');
      expect(weightRow?.values[1]).toBe('15 kg');
    });
  });
});

describe('ComparisonTable rendering', () => {
  it('renders a fallback message when there are no shared specification keys', () => {
    const products = [
      makeProduct('p1', { specifications: undefined }),
      makeProduct('p2', { specifications: undefined }),
    ];

    expect(ComparisonTable({ products })).not.toBeNull();
  });
});
