import { renderHook } from '@testing-library/react';
import { useSelectedShippingMethod } from './useSelectedShippingMethod';

const mockUseCheckoutStore = jest.fn();

jest.mock('@/providers/StoreProvider', () => ({
  useCheckoutStore: () => mockUseCheckoutStore(),
}));

describe('useSelectedShippingMethod', () => {
  it('returns null when no shipping method is stored', () => {
    mockUseCheckoutStore.mockReturnValue({ shippingMethod: null });

    const { result } = renderHook(() => useSelectedShippingMethod());

    expect(result.current).toBeNull();
  });

  it('returns only the display overlay amount from the store', () => {
    mockUseCheckoutStore.mockReturnValue({
      shippingMethod: { methodId: 'de-standard-dhl', amount: 4.95 },
    });

    const { result } = renderHook(() => useSelectedShippingMethod());

    expect(result.current).toEqual({ amount: 4.95 });
  });
});
