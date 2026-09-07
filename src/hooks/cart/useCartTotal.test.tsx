import { renderHook } from '@testing-library/react';
import { useCartTotal } from './useCartTotal';

const mockUseCart = jest.fn();
const mockUseSession = jest.fn();
const mockUseSite = jest.fn();
const mockUseSelectedShippingMethod = jest.fn();

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
}));

jest.mock('../checkout/useSelectedShippingMethod', () => ({
  useSelectedShippingMethod: () => mockUseSelectedShippingMethod(),
}));

jest.mock('../session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../site/useSite', () => ({
  useSite: () => mockUseSite(),
}));

describe('useCartTotal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseCart.mockReturnValue({
      cart: null,
    });
    mockUseSession.mockReturnValue({
      session: null,
    });
    mockUseSite.mockReturnValue({
      site: null,
    });
    mockUseSelectedShippingMethod.mockReturnValue(null);
  });

  it('hides the cart minimum shipping estimate when no shipping method is picked', () => {
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 82.29, currency: 'EUR' },
        totalPrice: { amount: 82.3, currency: 'EUR' },
        shippingCosts: {
          amount: 0.01,
          currency: 'EUR',
          tax: {
            amount: 0,
            currency: 'EUR',
            netValue: 0.01,
            grossValue: 0.01,
            taxCode: 'ZERO',
            taxRate: 0,
          },
        },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(82.29);
    expect(result.current.shippingCosts).toBeUndefined();
    expect(result.current.shippingVat).toBe(0);
    expect(result.current.showShippingVat).toBe(false);
    expect(result.current.currency).toBe('EUR');
  });

  it('does not show cart shipping VAT until a checkout method is picked', () => {
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 107.7, currency: 'CHF' },
        totalPrice: { amount: 129.24, currency: 'CHF' },
        shippingCosts: {
          amount: 20,
          currency: 'CHF',
          tax: {
            amount: 1.54,
            currency: 'CHF',
            netValue: 20,
            grossValue: 21.54,
            taxCode: 'STANDARD',
            taxRate: 7.7,
          },
        },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(107.7);
    expect(result.current.shippingCosts).toBeUndefined();
    expect(result.current.shippingVat).toBe(0);
    expect(result.current.showShippingVat).toBe(false);
  });

  it('overlays the picked shipping fee so header and mini-cart match checkout', () => {
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 5708.49, currency: 'EUR' },
        totalPrice: { amount: 5708.49, currency: 'EUR' },
        shippingCosts: {
          amount: 0,
          currency: 'EUR',
          tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0, taxRate: 0 },
        },
      },
    });
    mockUseSelectedShippingMethod.mockReturnValue({ amount: 4.95 });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.shippingCosts).toBe(4.95);
    expect(result.current.cartTotal).toBe(5713.44);
    expect(result.current.showShippingVat).toBe(false);
  });

  it('prefers session currency when cart totals are in a different currency (stale until sync)', () => {
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 10, currency: 'USD' },
        totalPrice: { amount: 10, currency: 'USD' },
      },
    });
    mockUseSession.mockReturnValue({
      session: { currency: 'EUR' },
    });
    mockUseSite.mockReturnValue({
      site: {
        currencies: [{ id: 'USD' }, { id: 'EUR' }],
        defaultCurrency: { id: 'USD' },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(10);
    expect(result.current.currency).toBe('EUR');
  });

  it('falls back to session currency when no cart exists', () => {
    mockUseSession.mockReturnValue({
      session: { currency: 'USD' },
    });
    mockUseSite.mockReturnValue({
      site: {
        currencies: [{ id: 'USD' }, { id: 'EUR' }],
        defaultCurrency: { id: 'EUR' },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(0);
    expect(result.current.currency).toBe('USD');
  });

  it('uses cart currency when session currency is not allowed for the site', () => {
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 10, currency: 'USD' },
        totalPrice: { amount: 10, currency: 'USD' },
      },
    });
    mockUseSession.mockReturnValue({
      session: { currency: 'GBP' },
    });
    mockUseSite.mockReturnValue({
      site: {
        currencies: [{ id: 'USD' }, { id: 'EUR' }],
        defaultCurrency: { id: 'EUR' },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(10);
    expect(result.current.currency).toBe('USD');
  });

  it('falls back to site default currency when session currency is unsupported', () => {
    mockUseSession.mockReturnValue({
      session: { currency: 'GBP' },
    });
    mockUseSite.mockReturnValue({
      site: {
        currencies: [{ id: 'USD' }, { id: 'EUR' }],
        defaultCurrency: { id: 'EUR' },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.currency).toBe('EUR');
  });

  it('accepts site currency code matches when session currency uses the code value', () => {
    mockUseSession.mockReturnValue({
      session: { currency: 'USD' },
    });
    mockUseSite.mockReturnValue({
      site: {
        currencies: [
          { id: 'usd', code: 'USD' },
          { id: 'eur', code: 'EUR' },
        ],
        defaultCurrency: { id: 'eur' },
      },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.currency).toBe('USD');
  });

  it('keeps EUR as the final fallback when no cart, session, or site currency is available', () => {
    const { result } = renderHook(() => useCartTotal());

    expect(result.current.currency).toBe('EUR');
  });
});
