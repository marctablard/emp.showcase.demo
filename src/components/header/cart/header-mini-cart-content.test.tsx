/**
 * @jest-environment jsdom
 */
import React, { createRef } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Cart } from '@/platform/services/model/cart';
import { HeaderMiniCartContent } from './header-mini-cart-content';

const mockUseCartTotal = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => (namespace === 'cart' ? key : key),
  useLocale: () => 'en',
}));

jest.mock('@/hooks/cart/useCartTotal', () => ({
  useCartTotal: () => mockUseCartTotal(),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('./header-mini-cart-item-list', () => ({
  HeaderMiniCartItemList: () => <div data-testid="mini-cart-items" />,
}));

const CART: Cart = {
  id: 'cart-1',
  currency: 'EUR',
  site: 'main',
  items: [{ id: 'item-1', quantity: 1, price: { amount: 82.29, currency: 'EUR' } }],
  tax: { amount: 13.14, netValue: 69.15, grossValue: 82.29, currency: 'EUR' },
  subTotalPrice: { amount: 82.29, currency: 'EUR' },
  totalPrice: { amount: 82.3, currency: 'EUR' },
};

function money(amount: number): RegExp {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return new RegExp(`${whole}[.,]${fraction}`);
}

describe('HeaderMiniCartContent', () => {
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

  it('displays the mapped cart total and hides Shipping VAT when tax is 0', () => {
    render(
      <HeaderMiniCartContent
        loading={false}
        cart={CART}
        scrollHeight={false}
        scrollContainer={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByText('total').nextElementSibling).toHaveTextContent(money(82.3));
    expect(screen.queryByTestId('mini-cart-shipping-vat')).not.toBeInTheDocument();
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

    render(
      <HeaderMiniCartContent
        loading={false}
        cart={CART}
        scrollHeight={false}
        scrollContainer={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByTestId('mini-cart-shipping-vat')).toHaveTextContent('summary.shippingVat');
    expect(screen.getByTestId('mini-cart-shipping-vat')).toHaveTextContent(money(1.54));
  });

  it('shows a 0 shipping fee instead of calculatedAtCheckout', () => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 82.29,
      goodsGross: 82.29,
      goodsNet: 69.15,
      goodsVat: 13.14,
      shippingCosts: 0,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
    });

    render(
      <HeaderMiniCartContent
        loading={false}
        cart={CART}
        scrollHeight={false}
        scrollContainer={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.queryByText('summary.calculatedAtCheckout')).not.toBeInTheDocument();
    expect(screen.getByText('summary.shippingCosts').nextElementSibling).toHaveTextContent(money(0));
  });

  it('uses the coupon-adjusted goods VAT instead of pre-discount cart.tax', () => {
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

    render(
      <HeaderMiniCartContent
        loading={false}
        cart={CART}
        scrollHeight={false}
        scrollContainer={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByText('summary.valueOfGoods').nextElementSibling).toHaveTextContent(money(68.94));
    expect(screen.getByText('tax').nextElementSibling).toHaveTextContent(money(11.01));
    expect(screen.queryByText(money(82.29))).not.toBeInTheDocument();
    expect(screen.queryByText(money(13.14))).not.toBeInTheDocument();
  });
});
