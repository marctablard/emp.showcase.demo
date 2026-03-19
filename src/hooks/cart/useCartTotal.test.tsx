import { renderHook } from '@testing-library/react';
import { useCartTotal } from './useCartTotal';

const mockUseCheckout = jest.fn();
const mockUseCart = jest.fn();
const mockUseSession = jest.fn();
const mockUseSite = jest.fn();

jest.mock('../checkout/useCheckout', () => ({
  useCheckout: () => mockUseCheckout(),
}));

jest.mock('../cart/useCart', () => ({
  useCart: () => mockUseCart(),
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

    mockUseCheckout.mockReturnValue({
      shippingMethod: null,
    });
    mockUseCart.mockReturnValue({
      cart: null,
    });
    mockUseSession.mockReturnValue({
      session: null,
    });
    mockUseSite.mockReturnValue({
      site: null,
    });
  });

  it('prefers cart currency when an active cart exists', () => {
    mockUseCheckout.mockReturnValue({
      shippingMethod: { amount: 5 },
    });
    mockUseCart.mockReturnValue({
      cart: {
        subTotalPrice: { amount: 10, currency: 'USD' },
        totalPrice: { amount: 10, currency: 'USD' },
      },
    });
    mockUseSession.mockReturnValue({
      session: { currency: 'EUR' },
    });

    const { result } = renderHook(() => useCartTotal());

    expect(result.current.cartTotal).toBe(15);
    expect(result.current.currency).toBe('USD');
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
