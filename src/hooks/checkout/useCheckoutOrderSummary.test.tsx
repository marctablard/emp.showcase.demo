import { renderHook } from '@testing-library/react';
import { getTaxClasses } from '@/lib/client/tax';
import { useCheckoutOrderSummary } from './useCheckoutOrderSummary';

const mockUseCart = jest.fn();
const mockUseSelectedShippingMethod = jest.fn();
const mockGetTaxClasses = getTaxClasses as jest.MockedFunction<typeof getTaxClasses>;

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
}));

jest.mock('./useSelectedShippingMethod', () => ({
  useSelectedShippingMethod: () => mockUseSelectedShippingMethod(),
}));

jest.mock('@/lib/client/tax', () => ({
  getTaxClasses: jest.fn(),
}));

const CH_CART_TAX = { amount: 7.7, netValue: 100, grossValue: 107.7, currency: 'CHF' };

function cartState(
  overrides: {
    shippingVat?: number;
    shippingTaxRate?: number;
    shippingTaxCode?: string;
    feesAmount?: number;
    total?: number;
  } = {},
) {
  const shippingVat = overrides.shippingVat ?? 1.54;
  return {
    cart: {
      id: 'cart-1',
      currency: 'CHF',
      tax: CH_CART_TAX,
      fees: overrides.feesAmount !== undefined ? { amount: overrides.feesAmount, currency: 'CHF' } : undefined,
      shippingCosts: {
        amount: 20,
        currency: 'CHF',
        tax: {
          amount: shippingVat,
          currency: 'CHF',
          netValue: 20,
          grossValue: 20 + shippingVat,
          taxCode: overrides.shippingTaxCode ?? 'STANDARD',
          taxRate: overrides.shippingTaxRate ?? 7.7,
        },
      },
      totalPrice: { amount: overrides.total ?? 129.24, currency: 'CHF' },
    },
  };
}

describe('useCheckoutOrderSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCart.mockReturnValue(cartState());
    mockUseSelectedShippingMethod.mockReturnValue(null);
  });

  it('uses checkoutCart.tax.amount as goodsVat (CH 7.7, not leftover 19)', () => {
    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.goodsVat).toBe(7.7);
    expect(result.current.goodsVat).not.toBe(19);
    expect(result.current.goodsNet).toBe(100);
  });

  it('reads shipping VAT and total from the mapped cart and does not look up tax classes', () => {
    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.shippingVat).toBe(1.54);
    expect(result.current.showShippingVat).toBe(true);
    expect(result.current.shippingVatLookupFailed).toBe(false);
    expect(result.current.total).toBe(129.24);
    expect(mockGetTaxClasses).not.toHaveBeenCalled();
  });

  it('uses cart.totalPrice.amount even when a frontend fee × rate sum would differ', () => {
    mockUseCart.mockReturnValue(cartState({ total: 82.3, shippingVat: 0, shippingTaxRate: 0 }));

    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.total).toBe(82.3);
    expect(result.current.total).not.toBe(127.7);
  });

  it('hides Shipping VAT when the cart shipping tax is 0', () => {
    mockUseCart.mockReturnValue(
      cartState({ shippingVat: 0, shippingTaxRate: 0, shippingTaxCode: 'ZERO', total: 127.7 }),
    );

    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.shippingVat).toBe(0);
    expect(result.current.showShippingVat).toBe(false);
    expect(result.current.shippingVatLookupFailed).toBe(false);
  });

  it('includes cart fees from the mapped cart', () => {
    mockUseCart.mockReturnValue(cartState({ feesAmount: 5, total: 134.24 }));

    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.total).toBe(134.24);
    expect(result.current.feesTotal).toBe(5);
  });

  it('overlays the picked shipping fee so Order Summary matches mini-cart', () => {
    mockUseCart.mockReturnValue(
      cartState({ shippingVat: 0, shippingTaxRate: 0, shippingTaxCode: 'ZERO', total: 127.7 }),
    );
    mockUseSelectedShippingMethod.mockReturnValue({ amount: 4.95 });

    const { result } = renderHook(() => useCheckoutOrderSummary());

    expect(result.current.shippingFee).toBe(4.95);
    expect(result.current.shippingVat).toBe(0);
    expect(result.current.showShippingVat).toBe(false);
    expect(result.current.total).toBe(112.65);
  });
});
