import { act, renderHook } from '@testing-library/react';
import type { Cart, CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { useCheckoutPromoCode } from './useCheckoutPromoCode';

const FIGMA_PROMO_ERROR = 'This is not an active promo code. Please check your entry.';

const mockApplyDiscount = jest.fn();
const mockRemoveDiscount = jest.fn();
const mockUseCart = jest.fn();

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'promoCodeError' ? FIGMA_PROMO_ERROR : key),
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

    expect(result.current.fieldError).toBe(FIGMA_PROMO_ERROR);
    expect(result.current.fieldError).not.toContain('segment');
    expect(result.current.discounts).toEqual([existingDiscount]);
    expect(mockApplyDiscount).toHaveBeenCalledWith('NOTALLOWED');
    expect(mockApplyDiscount).toHaveBeenCalledTimes(1);
  });

  it('maps an inactive code apply failure to the generic Figma error', async () => {
    mockApplyDiscount.mockRejectedValue(new Error('inactive'));

    const { result } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('INACTIVE');
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.fieldError).toBe(FIGMA_PROMO_ERROR);
    expect(result.current.fieldError).not.toContain('segment');
    expect(result.current.fieldError).not.toMatch(/currency/i);
    expect(mockApplyDiscount).toHaveBeenCalledWith('INACTIVE');
  });

  it.each([
    ['coupon_not_found', FIGMA_PROMO_ERROR],
    ['coupon_not_active', FIGMA_PROMO_ERROR],
    ['coupon_not_eligible', 'promoCodeNotEligible'],
    ['coupon_not_applicable', 'promoCodeNotApplicable'],
    ['coupon_already_applied', 'promoCodeAlreadyApplied'],
    ['discount_not_applicable', FIGMA_PROMO_ERROR],
    ['some_future_reason', FIGMA_PROMO_ERROR],
  ])('picks the copy for API reason %s', async (reason, expectedMessage) => {
    const err: Error & { reason?: string; status?: number } = new Error('Discount is not applicable');
    err.reason = reason;
    err.status = 400;
    mockApplyDiscount.mockRejectedValue(err);

    const { result } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('VKTEST-PROMO03');
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.fieldError).toBe(expectedMessage);
  });

  it('maps cannot apply twice (already exists on cart) to the generic Figma error', async () => {
    mockApplyDiscount.mockRejectedValue(new Error('Coupon already exists on this cart'));

    const { result } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('LS10PTOTAL');
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(result.current.fieldError).toBe(FIGMA_PROMO_ERROR);
    expect(result.current.fieldError).not.toContain('already exists');
    expect(result.current.fieldError).not.toContain('segment');
    expect(result.current.fieldError).not.toMatch(/currency/i);
    expect(result.current.discounts).toEqual([existingDiscount]);
    expect(mockApplyDiscount).toHaveBeenCalledWith('LS10PTOTAL');
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
    expect(result.current.fieldError).toBe(FIGMA_PROMO_ERROR);

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

  it('applies a second promo with a second successful applyDiscount call', async () => {
    const firstDiscount: CartAppliedDiscount = {
      code: 'ACCESSORIES15',
      name: '15% discount',
      discountIndex: 0,
      amount: 1.5,
      currency: 'EUR',
    };
    const secondDiscount: CartAppliedDiscount = {
      code: 'SOLAR10',
      name: '10% discount',
      discountIndex: 1,
      amount: 10,
      currency: 'EUR',
    };

    mockUseCart.mockReturnValue({
      cart: cartWithDiscount({ discounts: [] }),
      applyDiscount: mockApplyDiscount,
      removeDiscount: mockRemoveDiscount,
    });
    mockApplyDiscount.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(() => useCheckoutPromoCode());

    await act(async () => {
      result.current.setCode('ACCESSORIES15');
    });
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApplyDiscount).toHaveBeenCalledWith('ACCESSORIES15');

    mockUseCart.mockReturnValue({
      cart: cartWithDiscount({ discounts: [firstDiscount] }),
      applyDiscount: mockApplyDiscount,
      removeDiscount: mockRemoveDiscount,
    });
    rerender();

    await act(async () => {
      result.current.setCode('SOLAR10');
    });
    await act(async () => {
      await result.current.apply();
    });

    expect(mockApplyDiscount).toHaveBeenCalledWith('SOLAR10');
    expect(mockApplyDiscount).toHaveBeenCalledTimes(2);

    mockUseCart.mockReturnValue({
      cart: cartWithDiscount({ discounts: [firstDiscount, secondDiscount] }),
      applyDiscount: mockApplyDiscount,
      removeDiscount: mockRemoveDiscount,
    });
    rerender();

    expect(result.current.fieldError).toBeNull();
    expect(result.current.discounts).toEqual([firstDiscount, secondDiscount]);
  });

  it('tracks removingIndex while a chip is being removed', async () => {
    let resolveRemove!: () => void;
    mockRemoveDiscount.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveRemove = resolve;
      }),
    );

    const { result } = renderHook(() => useCheckoutPromoCode());
    expect(result.current.removingIndex).toBeNull();

    let removePromise: Promise<void>;
    act(() => {
      removePromise = result.current.remove(0);
    });
    expect(result.current.removingIndex).toBe(0);
    expect(result.current.removing).toBe(true);

    await act(async () => {
      resolveRemove();
      await removePromise;
    });

    expect(result.current.removingIndex).toBeNull();
    expect(result.current.removing).toBe(false);
  });
});
