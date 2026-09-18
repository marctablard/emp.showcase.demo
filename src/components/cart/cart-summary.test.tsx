/**
 * @jest-environment jsdom
 */
import React, { createRef } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import deCartTranslations from '@/i18n/translations/de/cart/index.json';
import enCartTranslations from '@/i18n/translations/en/cart/index.json';
import type { Cart } from '@/platform/services/model/cart';
import { CartSummary } from './cart-summary';

const mockUseCartTotal = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('@/hooks/cart/useCartTotal', () => ({
  useCartTotal: () => mockUseCartTotal(),
}));

jest.mock('@/hooks/ui/useElementScroll', () => ({
  useElementScroll: () => ({
    isFixed: false,
    isFixedToTop: false,
    isContainerBottom: false,
  }),
}));

jest.mock('./cart-request', () => ({
  CartRequest: () => null,
}));

jest.mock('../ui/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const CART: Cart = {
  id: 'cart-1',
  currency: 'EUR',
  site: 'main',
  items: [],
  tax: { amount: 13.14, netValue: 69.15, grossValue: 82.29, currency: 'EUR' },
  subTotalPrice: { amount: 82.29, currency: 'EUR' },
  totalPrice: { amount: 82.3, currency: 'EUR' },
};

function money(amount: number): RegExp {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return new RegExp(`${whole}[.,]${fraction}`);
}

describe('CartSummary', () => {
  beforeEach(() => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 82.3,
      goodsGross: 82.29,
      goodsNet: 69.15,
      goodsVat: 13.14,
      shippingCosts: 0.01,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
    });
  });

  it('uses ticket Shipping VAT copy (EN/DE) and does not copy account Shipping Tax', () => {
    expect(enCartTranslations.summary.shippingVat).toBe('Shipping VAT');
    expect(enCartTranslations.summary.shippingVat).not.toBe('Shipping Tax');
    expect(deCartTranslations.summary.shippingVat).toBe('Versand-MwSt.');
    expect(deCartTranslations.summary.shippingVat).not.toBe('Shipping Tax');
  });

  it('displays the mapped cart total and hides Shipping VAT when tax is 0', () => {
    render(<CartSummary cart={CART} boundingContent={createRef<HTMLDivElement>()} onRequestQuote={jest.fn()} />);

    expect(screen.getByText('total').nextElementSibling).toHaveTextContent(money(82.3));
    expect(screen.queryByTestId('cart-summary-shipping-vat')).not.toBeInTheDocument();
    expect(screen.queryByText('shippingVat')).not.toBeInTheDocument();
  });

  it('shows Shipping VAT when the mapped cart tax amount is greater than 0', () => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 129.24,
      goodsGross: 82.29,
      goodsNet: 69.15,
      goodsVat: 13.14,
      shippingCosts: 20,
      shippingVat: 1.54,
      showShippingVat: true,
      currency: 'CHF',
    });

    render(<CartSummary cart={CART} boundingContent={createRef<HTMLDivElement>()} onRequestQuote={jest.fn()} />);

    expect(screen.getByTestId('cart-summary-shipping-vat')).toHaveTextContent('shippingVat');
    expect(screen.getByTestId('cart-summary-shipping-vat')).toHaveTextContent(money(1.54));
    expect(screen.getByText('total').nextElementSibling).toHaveTextContent(money(129.24));
  });

  it('uses the coupon-adjusted goods breakdown instead of pre-discount cart.tax', () => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 71.11,
      goodsGross: 68.94,
      goodsNet: 57.93,
      goodsVat: 11.01,
      shippingCosts: undefined,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
    });

    render(<CartSummary cart={CART} boundingContent={createRef<HTMLDivElement>()} onRequestQuote={jest.fn()} />);

    expect(screen.getByText('valueOfGoods').nextElementSibling).toHaveTextContent(money(68.94));
    expect(screen.getByText('netValueOfGoods').nextElementSibling).toHaveTextContent(money(57.93));
    expect(screen.getByText('tax').nextElementSibling).toHaveTextContent(money(11.01));
    expect(screen.queryByText(money(82.29))).not.toBeInTheDocument();
    expect(screen.queryByText(money(69.15))).not.toBeInTheDocument();
    expect(screen.queryByText(money(13.14))).not.toBeInTheDocument();
  });
});
