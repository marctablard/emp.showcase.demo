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

  it('renders the idle field, Apply control, and info copy without an error', () => {
    render(<CheckoutPromoCodeBox />);

    const input = screen.getByTestId('checkout-promoCode');
    expect(input).toHaveAttribute('placeholder', 'promoCode');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveClass('bg-surface-primary');
    const applyButton = screen.getByTestId('checkout-applyPromo');
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveClass('font-headlines', 'tracking-[var(--desktop-spacing-action-button)]');
    const promoInfo = screen.getByTestId('checkout-promoInfo');
    expect(promoInfo).toHaveTextContent('promoCodeOnePerProduct');
    expect(promoInfo).toHaveTextContent('promoCodeBestPrice');
    const infoCopy = promoInfo.querySelector('p');
    expect(infoCopy).toHaveClass('text-sm', 'font-bold');
    expect(infoCopy?.querySelector('.font-bold')).toHaveTextContent('promoCodeOnePerProduct');
    expect(infoCopy?.querySelector('.font-normal')).toHaveTextContent('promoCodeBestPrice');
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
});
