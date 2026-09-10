import { act, renderHook } from '@testing-library/react';
import type { Cart, CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { useCheckoutPromoCode } from './useCheckoutPromoCode';

const mockApplyDiscount = jest.fn();
const mockRemoveDiscount = jest.fn();
const mockUseCart = jest.fn();

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

const existingDiscount: CartAppliedDiscount = {
  code: 'LS10PTOTAL',
  discountIndex: 0,
  amount: 10,
  currency: 'EUR',
};

function cartWithDiscount(overrides?: Partial<Cart>): Cart {
  return {
    id: 'cart-1',
    currency: 'EUR',
    site: 'main',
    items: [],
    totalPrice: { amount: 90, currency: 'EUR' },
    subTotalPrice: { amount: 100, currency: 'EUR' },
    tax: { amount: 0, currency: 'EUR', netValue: 100, grossValue: 100 },
    discounts: [existingDiscount],
    ...overrides,
  };
}

describe('useCheckoutPromoCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyDiscount.mockReset();
    mockRemoveDiscount.mockReset();
    mockUseCart.mockReturnValue({
      cart: cartWithDiscount(),
      applyDiscount: mockApplyDiscount,
      removeDiscount: mockRemoveDiscount,
    });
  });

  it('does not call applyDiscount when the code is empty', async () => {
    const { result } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      await result.current.apply();
    });
    expect(mockApplyDiscount).not.toHaveBeenCalled();

    await act(async () => {
      result.current.setCode('   ');
    });
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApplyDiscount).not.toHaveBeenCalled();
  });

  it('sets a generic field error on failed apply and keeps mocked cart discounts', async () => {
    mockApplyDiscount.mockRejectedValue(new Error('You are not in segment GOLD'));

    const { result } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('NOTALLOWED');
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.fieldError).toBe('promoCodeError');
    expect(result.current.fieldError).not.toContain('segment');
    expect(result.current.discounts).toEqual([existingDiscount]);
    expect(mockApplyDiscount).toHaveBeenCalledWith('NOTALLOWED');
    expect(mockApplyDiscount).toHaveBeenCalledTimes(1);
  });

  it('clears the field error on success and relies on updated cart discounts', async () => {
    mockApplyDiscount.mockRejectedValueOnce(new Error('Coupon already exists on this cart'));
    mockApplyDiscount.mockResolvedValueOnce(undefined);

    const { result, rerender } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('BADCODE');
    });
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.fieldError).toBe('promoCodeError');

    const updatedDiscount: CartAppliedDiscount = {
      code: 'LS10PTOTAL',
      name: '10% off',
      discountIndex: 0,
      amount: 12.5,
      currency: 'EUR',
    };
    mockUseCart.mockReturnValue({
      cart: cartWithDiscount({ discounts: [updatedDiscount] }),
      applyDiscount: mockApplyDiscount,
      removeDiscount: mockRemoveDiscount,
    });

    await act(async () => {
      result.current.setCode('LS10PTOTAL');
    });
    await act(async () => {
      await result.current.apply();
    });
    rerender();

    expect(result.current.fieldError).toBeNull();
    expect(result.current.discounts).toEqual([updatedDiscount]);
    expect(result.current.discounts[0]?.code).toBe('LS10PTOTAL');
  });
});
