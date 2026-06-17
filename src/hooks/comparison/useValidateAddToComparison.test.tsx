import { renderHook } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import { useValidateAddToComparison } from './useValidateAddToComparison';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'product-1',
    name: { en: 'Product 1' },
    description: { en: 'Description' },
    purchasable: true,
    ...overrides,
  };
}

describe('useValidateAddToComparison', () => {
  it('blocks explicit parent variants from comparison', () => {
    const { result } = renderHook(() =>
      useValidateAddToComparison(
        makeProduct({
          isParentVariant: true,
          purchasable: false,
          variantAttributes: [],
        }),
      ),
    );

    expect(result.current).toEqual({
      disabled: true,
      tooltip: 'compareTooltipMasterProduct',
    });
  });

  it('does not block non-parent products that happen to have variant attributes', () => {
    const { result } = renderHook(() =>
      useValidateAddToComparison(
        makeProduct({
          isParentVariant: false,
          purchasable: false,
          variantAttributes: [
            {
              key: 'color',
              values: [{ key: 'red', selected: false }],
            },
          ],
        }),
      ),
    );

    expect(result.current).toEqual({
      disabled: false,
      tooltip: undefined,
    });
  });
});
