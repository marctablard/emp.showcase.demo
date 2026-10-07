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
    expect(screen.getByText('promoCodeInfo')).toBeInTheDocument();
    expect(screen.queryByTestId('cart-summary-promoApplied')).not.toBeInTheDocument();
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

  it('keeps the checkout note when the only discount row is hidden from the shopper', () => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 82.3,
      goodsGross: 82.29,
      goodsNet: 69.15,
      goodsVat: 13.14,
      shippingCosts: undefined,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
      breakdown: {
        goodsNet: 69.15,
        goodsVat: 13.14,
        shippingFee: undefined,
        shippingVat: 0,
        showShippingVat: false,
        shippingVatLookupFailed: false,
        feesTotal: 0,
        total: 82.3,
        currency: 'EUR',
        hasAppliedCoupons: true,
      },
    });

    render(
      <CartSummary
        cart={{
          ...CART,
          discounts: [
            { code: 'TOTAL', discountIndex: 0, amount: 10, currency: 'EUR' },
            { code: 'OLD', discountIndex: 1, amount: 5, currency: 'EUR', valid: false },
          ],
        }}
        boundingContent={createRef<HTMLDivElement>()}
        onRequestQuote={jest.fn()}
      />,
    );

    expect(screen.getByText('promoCodeInfo')).toBeInTheDocument();
    expect(screen.queryByTestId('cart-summary-promoApplied')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-appliedPromo-TOTAL')).not.toBeInTheDocument();
  });

  it('matches checkout when a coupon is applied and replaces the enter-at-checkout note', () => {
    expect(enCartTranslations.summary.promoAppliedTitle).toBe('Your order overview already showing discounted price.');
    expect(enCartTranslations.summary.promoAppliedInfo).toContain('checkout page');
    expect(deCartTranslations.summary.promoAppliedTitle.length).toBeGreaterThan(0);
    expect(deCartTranslations.summary.promoAppliedInfo.length).toBeGreaterThan(0);

    mockUseCartTotal.mockReturnValue({
      cartTotal: 71.11,
      goodsGross: 68.94,
      goodsNet: 57.93,
      goodsVat: 11.01,
      shippingCosts: undefined,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
      breakdown: {
        goodsNet: 57.93,
        goodsVat: 11.01,
        shippingFee: undefined,
        shippingVat: 0,
        showShippingVat: false,
        shippingVatLookupFailed: false,
        feesTotal: 0,
        total: 71.11,
        currency: 'EUR',
        hasAppliedCoupons: true,
        couponApplyBasis: 'net',
        originalGoodsNet: 69.15,
        savingsTotal: 11.22,
        goodsDiscounted: true,
      },
    });

    render(
      <CartSummary
        cart={{
          ...CART,
          discounts: [
            {
              code: 'SOLAR10',
              name: 'Solar discount',
              discountIndex: 0,
              amount: 11.22,
              currency: 'EUR',
              type: 'PERCENT',
            },
          ],
        }}
        boundingContent={createRef<HTMLDivElement>()}
        onRequestQuote={jest.fn()}
      />,
    );

    expect(screen.getByTestId('cart-summary-promoApplied')).toHaveTextContent('promoAppliedTitle');
    expect(screen.getByTestId('cart-summary-promoApplied')).toHaveTextContent('promoAppliedInfo');
    expect(screen.queryByText('promoCodeInfo')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-originalValueOfGoods')).toHaveTextContent(money(69.15));
    expect(screen.getByTestId('cart-yourSavings')).toHaveTextContent(money(11.22));
    expect(screen.getByText('netValueOfGoods').nextElementSibling).toHaveTextContent(money(57.93));
    expect(screen.getByTestId('cart-appliedPromo-SOLAR10')).toHaveTextContent('Solar discount');
    expect(screen.getByTestId('cart-appliedPromoAmount-SOLAR10')).toHaveTextContent(money(11.22));
    expect(screen.queryByTestId('cart-removePromo-SOLAR10')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-summary-total')).toHaveTextContent(money(71.11));
    expect(screen.getByText('calculatedAtCheckout')).toBeInTheDocument();
  });

  it('lists a free-shipping coupon and strikes the shipping fee the same way as checkout', () => {
    mockUseCartTotal.mockReturnValue({
      cartTotal: 82.29,
      goodsGross: 82.29,
      goodsNet: 69.15,
      goodsVat: 13.14,
      shippingCosts: 12,
      shippingVat: 0,
      showShippingVat: false,
      currency: 'EUR',
      breakdown: {
        goodsNet: 69.15,
        goodsVat: 13.14,
        shippingFee: 12,
        shippingVat: 0,
        showShippingVat: false,
        shippingVatLookupFailed: false,
        feesTotal: 0,
        total: 82.29,
        currency: 'EUR',
        hasAppliedCoupons: true,
        couponApplyBasis: 'net',
        originalGoodsNet: 69.15,
        goodsDiscounted: false,
        shippingFree: true,
      },
    });

    render(
      <CartSummary
        cart={{
          ...CART,
          discounts: [
            {
              code: 'SHIPFREE',
              name: 'Free delivery',
              discountIndex: 1,
              amount: 0,
              currency: 'EUR',
              type: 'FREE_SHIPPING',
            },
          ],
        }}
        boundingContent={createRef<HTMLDivElement>()}
        onRequestQuote={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('cart-originalValueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-yourSavings')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-appliedPromoAmount-SHIPFREE')).toHaveTextContent('promoFreeShipping');
    const shippingFree = screen.getByTestId('cart-shippingFree');
    expect(shippingFree.querySelector('.line-through')).toHaveTextContent(money(12));
    expect(shippingFree).toHaveTextContent('free');
    expect(screen.getByTestId('cart-summary-total')).toHaveTextContent(money(82.29));
  });
});
