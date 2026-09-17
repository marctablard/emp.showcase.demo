/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { CheckoutPromoCodeBox } from './checkout-promo-code';

const FIGMA_PROMO_ERROR = 'This is not an active promo code. Please check your entry.';

const mockPromo = {
  code: '',
  setCode: jest.fn(),
  applying: false,
  removing: false,
  removingIndex: null as number | null,
  fieldError: null as string | null,
  apply: jest.fn(),
  remove: jest.fn(),
  discounts: [] as CartAppliedDiscount[],
};

/** Locale-agnostic amount matcher: CI formats with the German default language ("-1,50 €"). */
function money(amount: number): RegExp {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return new RegExp(`${whole}[.,]${fraction}`);
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'promoCodeError' ? FIGMA_PROMO_ERROR : key),
}));

jest.mock('@/hooks/checkout/useCheckoutPromoCode', () => ({
  useCheckoutPromoCode: () => mockPromo,
}));

function resetPromoMock() {
  mockPromo.code = '';
  mockPromo.setCode = jest.fn((value: string) => {
    mockPromo.code = value;
  });
  mockPromo.applying = false;
  mockPromo.removing = false;
  mockPromo.removingIndex = null;
  mockPromo.fieldError = null;
  mockPromo.apply = jest.fn();
  mockPromo.remove = jest.fn();
  mockPromo.discounts = [];
}

describe('CheckoutPromoCodeBox', () => {
  beforeEach(() => {
    resetPromoMock();
  });

  it('promo box is available: idle field and Apply control without an error or info note', () => {
    render(<CheckoutPromoCodeBox />);

    const input = screen.getByTestId('checkout-promoCode');
    expect(input).toHaveAttribute('placeholder', 'promoCode');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveClass('bg-surface-primary');
    const applyButton = screen.getByTestId('checkout-applyPromo');
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveClass('font-headlines', 'tracking-[var(--desktop-spacing-action-button)]', 'w-[91px]');
    expect(screen.queryByTestId('checkout-promoInfo')).not.toBeInTheDocument();
    expect(screen.queryByText('promoCodeBestPrice')).not.toBeInTheDocument();
    expect(screen.queryByText('promoCodeOnePerProduct')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-promoError')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-appliedPromo-ACCESSORIES15')).not.toBeInTheDocument();
  });

  it('shows an invalid field and the generic Figma error text', () => {
    mockPromo.code = 'SOLAR500';
    mockPromo.fieldError = FIGMA_PROMO_ERROR;

    render(<CheckoutPromoCodeBox />);

    const input = screen.getByTestId('checkout-promoCode');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-dirty-error', 'true');
    expect(input).not.toHaveClass('bg-surface-primary');
    expect(screen.getByTestId('checkout-promoError')).toHaveTextContent(FIGMA_PROMO_ERROR);
    expect(screen.getByTestId('checkout-promoError')).toHaveClass('text-sm', 'leading-5', 'text-text-error');
    expect(screen.queryByText(/segment/i)).not.toBeInTheDocument();
  });

  it('shows the generic Figma error for an inactive promo code', () => {
    mockPromo.code = 'INACTIVE';
    mockPromo.fieldError = FIGMA_PROMO_ERROR;

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-promoError')).toHaveTextContent(FIGMA_PROMO_ERROR);
    expect(screen.queryByText(/segment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/currency/i)).not.toBeInTheDocument();
  });

  it('shows the same generic Figma error when a promo cannot be applied twice', () => {
    mockPromo.code = 'ACCESSORIES15';
    mockPromo.fieldError = FIGMA_PROMO_ERROR;
    mockPromo.discounts = [
      {
        code: 'ACCESSORIES15',
        name: '15% discount',
        discountIndex: 0,
        amount: 1.5,
        currency: 'EUR',
      },
    ];

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-appliedPromo-ACCESSORIES15')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-promoError')).toHaveTextContent(FIGMA_PROMO_ERROR);
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/segment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/currency/i)).not.toBeInTheDocument();
  });

  it('never shows the dropped best-price info note on idle, error, or applied states', () => {
    const { rerender } = render(<CheckoutPromoCodeBox />);
    expect(screen.queryByTestId('checkout-promoInfo')).not.toBeInTheDocument();

    mockPromo.code = 'SOLAR500';
    mockPromo.fieldError = FIGMA_PROMO_ERROR;
    rerender(<CheckoutPromoCodeBox />);
    expect(screen.getByTestId('checkout-promoError')).toHaveTextContent(FIGMA_PROMO_ERROR);
    expect(screen.queryByTestId('checkout-promoInfo')).not.toBeInTheDocument();

    mockPromo.fieldError = null;
    mockPromo.discounts = [
      {
        code: 'ACCESSORIES15',
        name: '15% discount',
        discountIndex: 0,
        amount: 1.5,
        currency: 'EUR',
      },
    ];
    rerender(<CheckoutPromoCodeBox />);
    expect(screen.getByTestId('checkout-appliedPromo-ACCESSORIES15')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-promoInfo')).not.toBeInTheDocument();
  });

  it('renders an applied chip with remove button and does not invent Figma description copy', () => {
    mockPromo.discounts = [
      {
        code: 'ACCESSORIES15',
        name: '15% discount',
        discountIndex: 0,
        amount: 1.5,
        currency: 'EUR',
      },
    ];

    render(<CheckoutPromoCodeBox />);

    const chip = screen.getByTestId('checkout-appliedPromo-ACCESSORIES15');
    expect(chip).toHaveTextContent('ACCESSORIES15');
    expect(chip).toHaveTextContent('15% discount');
    expect(chip).not.toHaveTextContent('on accessories*');
    expect(chip.querySelector('p.font-normal')).toHaveTextContent('15% discount');
    expect(chip.querySelector('p.font-bold')).toBeNull();

    const removeButton = screen.getByTestId('checkout-removePromo-ACCESSORIES15');
    expect(removeButton).toHaveAttribute('type', 'button');
    expect(removeButton).toHaveClass('cursor-pointer');
    expect(removeButton).toHaveAccessibleName('removePromo');

    fireEvent.click(removeButton);
    expect(mockPromo.remove).toHaveBeenCalledWith(0);
  });

  it('shows the signed amount for a goods coupon chip', () => {
    mockPromo.discounts = [
      { code: 'ACCESSORIES15', name: '15% discount', discountIndex: 0, amount: 1.5, currency: 'EUR', type: 'PERCENT' },
    ];

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-appliedPromoAmount-ACCESSORIES15')).toHaveTextContent(money(1.5));
    expect(screen.getByTestId('checkout-appliedPromoAmount-ACCESSORIES15')).toHaveClass('text-sm');
  });

  it('hides TOTAL rollup and zero-effect goods coupons from the chip list', () => {
    mockPromo.discounts = [
      { code: 'TOTAL', name: '10% off order', discountIndex: 0, amount: 10, currency: 'EUR' },
      { code: 'NOMATCH', name: 'No match', discountIndex: 1, amount: 0, currency: 'EUR', type: 'PERCENT' },
      { code: 'ACCESSORIES15', name: '15% discount', discountIndex: 2, amount: 1.5, currency: 'EUR' },
    ];

    render(<CheckoutPromoCodeBox />);

    expect(screen.queryByTestId('checkout-appliedPromo-TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-appliedPromo-NOMATCH')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-appliedPromo-ACCESSORIES15')).toBeInTheDocument();
  });

  it('uses a progress cursor on the apply control while applying', () => {
    mockPromo.code = 'ACCESSORIES15';
    mockPromo.applying = true;

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-promoCode')).toHaveClass('cursor-progress');
    expect(screen.getByTestId('checkout-applyPromo')).toHaveClass('cursor-progress');
  });

  it('marks only the chip being removed as busy', () => {
    mockPromo.discounts = [
      { code: 'ACCESSORIES15', name: '15% discount', discountIndex: 0, amount: 1.5, currency: 'EUR' },
      { code: 'SOLAR10', name: '10% discount', discountIndex: 1, amount: 10, currency: 'EUR' },
    ];
    mockPromo.removingIndex = 0;

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-appliedPromo-ACCESSORIES15')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('checkout-removePromo-ACCESSORIES15')).toBeDisabled();
    expect(screen.getByTestId('checkout-appliedPromo-SOLAR10')).not.toHaveAttribute('aria-busy');
    expect(screen.getByTestId('checkout-removePromo-SOLAR10')).not.toBeDisabled();
  });

  it('omits the amount for a free-shipping coupon chip so the name takes the whole line', () => {
    mockPromo.discounts = [
      {
        code: 'VKTEST-PROMO03',
        name: 'Free shipping over 100',
        discountIndex: 0,
        amount: 0,
        currency: 'EUR',
        type: 'FREE_SHIPPING',
      },
    ];

    render(<CheckoutPromoCodeBox />);

    const chip = screen.getByTestId('checkout-appliedPromo-VKTEST-PROMO03');
    expect(chip).toHaveTextContent('Free shipping over 100');
    expect(screen.queryByTestId('checkout-appliedPromoAmount-VKTEST-PROMO03')).not.toBeInTheDocument();
    expect(chip).not.toHaveTextContent(money(0));
  });

  it('renders only the code row for a nameless free-shipping chip', () => {
    mockPromo.discounts = [
      { code: 'FREESHIP', discountIndex: 0, amount: 4.95, currency: 'EUR', type: 'FREE_SHIPPING' },
    ];

    render(<CheckoutPromoCodeBox />);

    const chip = screen.getByTestId('checkout-appliedPromo-FREESHIP');
    expect(chip.children).toHaveLength(1);
    expect(chip).not.toHaveTextContent(money(4.95));
  });

  it('renders applied codes in the green chip area', () => {
    mockPromo.discounts = [
      {
        code: 'ACCESSORIES15',
        name: '15% discount',
        discountIndex: 0,
        amount: 1.5,
        currency: 'EUR',
      },
    ];

    render(<CheckoutPromoCodeBox />);

    const chip = screen.getByTestId('checkout-appliedPromo-ACCESSORIES15');
    expect(chip.parentElement).toHaveClass('border-border-success', 'bg-surface-success');
    expect(chip.querySelector('svg')).toHaveClass('text-icon-success');
  });

  it('renders two chips when applying a second promo', () => {
    mockPromo.discounts = [
      {
        code: 'ACCESSORIES15',
        name: '15% discount',
        discountIndex: 0,
        amount: 1.5,
        currency: 'EUR',
      },
      {
        code: 'SOLAR10',
        name: '10% discount',
        discountIndex: 1,
        amount: 10,
        currency: 'EUR',
      },
    ];

    render(<CheckoutPromoCodeBox />);

    expect(screen.getByTestId('checkout-appliedPromo-ACCESSORIES15')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-appliedPromo-SOLAR10')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-removePromo-ACCESSORIES15')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-removePromo-SOLAR10')).toBeInTheDocument();
  });
});
