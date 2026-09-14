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
  fieldError: null as string | null,
  apply: jest.fn(),
  remove: jest.fn(),
  discounts: [] as CartAppliedDiscount[],
};

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
  mockPromo.fieldError = null;
  mockPromo.apply = jest.fn();
  mockPromo.remove = jest.fn();
  mockPromo.discounts = [];
}

describe('CheckoutPromoCodeBox', () => {
  beforeEach(() => {
    resetPromoMock();
  });

  it('promo box is available: idle field, Apply control, and info copy without an error', () => {
    render(<CheckoutPromoCodeBox />);

    const input = screen.getByTestId('checkout-promoCode');
    expect(input).toHaveAttribute('placeholder', 'promoCode');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveClass('bg-surface-primary');
    const applyButton = screen.getByTestId('checkout-applyPromo');
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveClass('font-headlines', 'tracking-[var(--desktop-spacing-action-button)]', 'w-[91px]');
    const promoInfo = screen.getByTestId('checkout-promoInfo');
    expect(promoInfo).toHaveTextContent('promoCodeOnePerProduct');
    expect(promoInfo).toHaveTextContent('promoCodeBestPrice');
    const infoCopy = promoInfo.querySelector('p');
    expect(infoCopy).toHaveClass('text-sm', 'font-normal', 'leading-5', 'text-text-body');
    expect(infoCopy).not.toHaveClass('font-bold');
    expect(infoCopy?.querySelector('.font-bold')).not.toBeInTheDocument();
    expect(promoInfo.querySelector('svg')).toHaveClass('text-icon-information');
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

  it('always shows info copy on idle, error, and applied chip states', () => {
    const { rerender } = render(<CheckoutPromoCodeBox />);
    expect(screen.getByTestId('checkout-promoInfo')).toHaveTextContent('promoCodeOnePerProduct');
    expect(screen.getByTestId('checkout-promoInfo')).toHaveTextContent('promoCodeBestPrice');

    mockPromo.code = 'SOLAR500';
    mockPromo.fieldError = FIGMA_PROMO_ERROR;
    rerender(<CheckoutPromoCodeBox />);
    expect(screen.getByTestId('checkout-promoError')).toHaveTextContent(FIGMA_PROMO_ERROR);
    expect(screen.getByTestId('checkout-promoInfo')).toBeInTheDocument();

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
    expect(screen.getByTestId('checkout-promoInfo')).toBeInTheDocument();
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

    const removeButton = screen.getByTestId('checkout-removePromo-ACCESSORIES15');
    expect(removeButton).toHaveAttribute('type', 'button');
    expect(removeButton).toHaveAccessibleName('removePromo');

    fireEvent.click(removeButton);
    expect(mockPromo.remove).toHaveBeenCalledWith(0);
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
