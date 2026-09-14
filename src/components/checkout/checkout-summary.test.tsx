/**
 * @jest-environment jsdom
 */
import React, { createRef } from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import deCheckoutTranslations from '@/i18n/translations/de/checkout/index.json';
import enCheckoutTranslations from '@/i18n/translations/en/checkout/index.json';
import type { CheckoutOrderSummaryBreakdown } from '@/lib/common/checkout-order-summary';
import CheckoutSummaryComponent from './checkout-summary';

const mockUseCheckout = jest.fn();
const mockUseCheckoutOrderSummary = jest.fn();
const mockUseCartTotal = jest.fn();
const mockUseCheckoutPromoCode = jest.fn();
const mockUseApprovalCheckout = jest.fn();
const mockTranslate = jest.fn((key: string) => key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
  useLocale: () => 'en',
}));

jest.mock('@/hooks/checkout/useCheckout', () => ({
  useCheckout: () => mockUseCheckout(),
}));

jest.mock('@/hooks/checkout/useCheckoutOrderSummary', () => ({
  useCheckoutOrderSummary: () => mockUseCheckoutOrderSummary(),
}));

jest.mock('@/hooks/cart/useCartTotal', () => ({
  useCartTotal: () => mockUseCartTotal(),
}));

jest.mock('@/hooks/checkout/useCheckoutPromoCode', () => ({
  useCheckoutPromoCode: () => mockUseCheckoutPromoCode(),
}));

jest.mock('@/hooks/approval/useApprovalCheckout', () => ({
  useApprovalCheckout: () => mockUseApprovalCheckout(),
}));

jest.mock('@/hooks/ui/useElementScroll', () => ({
  useElementScroll: () => ({
    isFixed: false,
    isFixedToTop: false,
    isContainerBottom: false,
  }),
}));

jest.mock('@/hooks/validation/useValidator', () => {
  const { useForm } = jest.requireActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    useValidator: () => ({
      form: useForm({ defaultValues: { termsAndConditions: false } }),
    }),
  };
});

jest.mock('./checkout-validation-registry', () => ({
  useCheckoutValidation: () => ({
    validateAll: jest.fn().mockResolvedValue({ valid: true }),
  }),
  useRegisterCheckoutForm: jest.fn(),
  focusFirstInvalid: jest.fn(),
}));

jest.mock('./approval-modal', () => ({
  ApprovalModal: () => null,
}));

const CONFIRMATION_ORACLE_STANDARD = { total: { gross: 129.24 } };
const CONFIRMATION_ORACLE_REDUCED = { total: { gross: 128.44 } };

const CH_CART = {
  id: 'cart-1',
  currency: 'CHF',
  subTotalPrice: { amount: 107.7, currency: 'CHF' },
  tax: { amount: 7.7, netValue: 100, grossValue: 107.7, currency: 'CHF' },
};

function breakdown(overrides: Partial<CheckoutOrderSummaryBreakdown> = {}): CheckoutOrderSummaryBreakdown {
  return {
    goodsNet: 100,
    goodsVat: 7.7,
    shippingFee: 20,
    shippingVat: 1.54,
    showShippingVat: true,
    shippingVatLookupFailed: false,
    feesTotal: 0,
    total: CONFIRMATION_ORACLE_STANDARD.total.gross,
    currency: 'CHF',
    ...overrides,
  };
}

function renderSummary() {
  const leftContent = createRef<HTMLDivElement>();
  return render(<CheckoutSummaryComponent leftContent={leftContent} onSubmit={jest.fn()} />);
}

/** Locale-tolerant money matcher (narrow/no-break spaces and `.` / `,` decimals). */
function money(amount: number): RegExp {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return new RegExp(`${whole}[.,]${fraction}`);
}

describe('CheckoutSummaryComponent', () => {
  beforeEach(() => {
    mockTranslate.mockImplementation((key: string) => key);
    mockUseCheckout.mockReturnValue({
      checkoutCart: CH_CART,
      loading: false,
    });
    mockUseCheckoutOrderSummary.mockReturnValue(breakdown());
    mockUseCartTotal.mockReturnValue({
      cartTotal: 99999,
      shippingCosts: 20,
      currency: 'CHF',
    });
    mockUseCheckoutPromoCode.mockReturnValue({
      code: '',
      setCode: jest.fn(),
      applying: false,
      removing: false,
      fieldError: null,
      apply: jest.fn(),
      remove: jest.fn(),
      discounts: [],
    });
    mockUseApprovalCheckout.mockReturnValue({
      requiresApproval: false,
      loading: false,
      setCartId: jest.fn(),
    });
  });

  it('renders t("title") and Order Overview when translations are not mocked as keys', () => {
    renderSummary();
    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    expect(enCheckoutTranslations.summary.title).toBe('Order Overview');
    expect(deCheckoutTranslations.summary.title).toBe('Bestellübersicht');

    cleanup();
    mockTranslate.mockImplementation((key: string) => (key === 'title' ? enCheckoutTranslations.summary.title : key));
    renderSummary();
    expect(screen.getByRole('heading', { name: 'Order Overview' })).toBeInTheDocument();
  });

  it('uses ticket Shipping fee / Shipping VAT copy (EN/DE) and does not copy account Shipping Tax', () => {
    expect(enCheckoutTranslations.summary.shippingFee).toBe('Shipping fee');
    expect(enCheckoutTranslations.summary.shippingVat).toBe('Shipping VAT');
    expect(enCheckoutTranslations.summary.shippingVat).not.toBe('Shipping Tax');
    expect(deCheckoutTranslations.summary.shippingFee).toBe('Versandgebühr');
    expect(deCheckoutTranslations.summary.shippingVat).toBe('Versand-MwSt.');
    expect(deCheckoutTranslations.summary.shippingVat).not.toBe('Shipping Tax');
  });

  it('keeps net-first goods rows and does not use useCartTotal cartTotal for the displayed total', () => {
    renderSummary();

    const netAmount = screen.getByText('netValueOfGoods').nextElementSibling;
    expect(netAmount).toHaveClass('font-bold');
    expect(netAmount).toHaveTextContent(money(100));
    expect(screen.getByTestId('checkout-summary-total')).toHaveTextContent(
      money(CONFIRMATION_ORACLE_STANDARD.total.gross),
    );
    expect(screen.queryByText(money(99999))).not.toBeInTheDocument();
    expect(mockUseCartTotal).not.toHaveBeenCalled();
  });

  it('shows Shipping fee and Shipping VAT when VAT is not 0, matching the confirmation oracle total', () => {
    renderSummary();

    expect(screen.getByText('shippingFee')).toBeInTheDocument();
    expect(screen.queryByText('shippingCosts')).not.toBeInTheDocument();
    expect(screen.queryByText(/freight/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toHaveTextContent('shippingVat');
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toHaveTextContent(money(1.54));
    expect(screen.getByTestId('checkout-summary-total')).toHaveTextContent(
      money(CONFIRMATION_ORACLE_STANDARD.total.gross),
    );
  });

  it('omits the Shipping VAT row when VAT is a successful 0', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        shippingVat: 0,
        showShippingVat: false,
        shippingVatLookupFailed: false,
        total: 127.7,
      }),
    );

    renderSummary();

    expect(screen.queryByTestId('checkout-summary-shipping-vat')).not.toBeInTheDocument();
    expect(screen.queryByText('shippingVat')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-summary-total')).toHaveTextContent(money(127.7));
    expect(screen.getByTestId('checkout-summary-total')).not.toHaveAttribute('data-shipping-vat-lookup-failed');
  });

  it('shows a different Shipping VAT than goods VAT when the shipping rate is 3.7%', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        shippingVat: 0.74,
        showShippingVat: true,
        total: CONFIRMATION_ORACLE_REDUCED.total.gross,
      }),
    );

    renderSummary();

    expect(screen.getByText('tax').nextElementSibling).toHaveTextContent(money(7.7));
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toHaveTextContent(money(0.74));
    expect(screen.getByTestId('checkout-summary-total')).toHaveTextContent(
      money(CONFIRMATION_ORACLE_REDUCED.total.gross),
    );
  });

  it('does not render a 0.00 Shipping VAT row or a confirmation-matching total when lookup failed', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        shippingVat: 0,
        showShippingVat: false,
        shippingVatLookupFailed: true,
        total: 127.7,
      }),
    );

    renderSummary();

    expect(screen.queryByTestId('checkout-summary-shipping-vat')).not.toBeInTheDocument();
    expect(screen.queryByText('shippingVat')).not.toBeInTheDocument();
    const totalRow = screen.getByTestId('checkout-summary-total');
    expect(totalRow).toHaveAttribute('data-shipping-vat-lookup-failed', 'true');
    expect(totalRow).not.toHaveTextContent(money(CONFIRMATION_ORACLE_STANDARD.total.gross));
    expect(totalRow).not.toHaveTextContent(money(127.7));
  });

  it('keeps the fees row using the breakdown amount', () => {
    mockUseCheckout.mockReturnValue({
      checkoutCart: { ...CH_CART, fees: { amount: 5, currency: 'CHF' } },
      loading: false,
    });
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        feesTotal: 5,
        total: 134.24,
      }),
    );

    renderSummary();

    expect(screen.getByText('fees').nextElementSibling).toHaveTextContent(money(5));
    expect(screen.getByTestId('checkout-summary-total')).toHaveTextContent(money(134.24));
  });

  it('shows calculatedAtCheckout when the shipping fee is missing', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        shippingFee: undefined,
        shippingVat: 0,
        showShippingVat: false,
        total: 107.7,
      }),
    );

    renderSummary();

    expect(screen.getByText('calculatedAtCheckout')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-summary-shipping-vat')).not.toBeInTheDocument();
  });

  it('promo box is available on payment and Inquire for Approval checkouts', () => {
    renderSummary();
    expect(screen.getByTestId('checkout-promoCode')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-applyPromo')).toBeInTheDocument();
    expect(screen.getByText('valueOfGoods')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-originalValueOfGoods')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-submitOrder')).toHaveTextContent('submitOrder');

    cleanup();
    mockUseApprovalCheckout.mockReturnValue({
      requiresApproval: true,
      loading: false,
      setCartId: jest.fn(),
    });
    renderSummary();
    expect(screen.getByTestId('checkout-promoCode')).toBeInTheDocument();
    expect(screen.getByText('inquireForApproval')).toBeInTheDocument();
  });

  it('Value of goods appearance change (net-applied): Original value of goods and Your savings', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        hasAppliedCoupons: true,
        originalGoodsNet: 100,
        savingsTotal: 10,
        goodsNet: 90,
        total: 119.24,
      }),
    );

    renderSummary();

    expect(screen.queryByText('valueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByText(money(107.7))).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-originalValueOfGoods')).toHaveTextContent('originalValueOfGoods');
    expect(screen.getByTestId('checkout-originalValueOfGoods')).toHaveTextContent(money(100));
    expect(screen.getByTestId('checkout-yourSavings')).toHaveTextContent('yourSavings');
    expect(screen.getByTestId('checkout-yourSavings')).toHaveTextContent(money(10));
    expect(screen.getByText('netValueOfGoods').nextElementSibling).toHaveTextContent(money(90));
    expect(screen.queryByTestId('checkout-originalGrossValue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-grossValueOfGoods')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-promoCode')).toBeInTheDocument();
  });

  it('Value of goods appearance change (gross-applied): net Value of goods plus Jira gross stack', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        hasAppliedCoupons: true,
        couponApplyBasis: 'gross',
        originalGoodsNet: 82.45,
        originalGoodsVat: 15.66,
        originalGoodsGross: 98.11,
        savingsTotal: 16.11,
        goodsDiscountedGross: 82,
        goodsNet: 70,
        goodsVat: 12,
        total: 119.24,
      }),
    );

    renderSummary();

    expect(screen.getByText('valueOfGoods')).toBeInTheDocument();
    expect(screen.getByText('valueOfGoods').nextElementSibling).toHaveTextContent(money(82.45));
    expect(screen.queryByText('originalValueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByText('netValueOfGoods')).not.toBeInTheDocument();
    expect(screen.getByText('tax').nextElementSibling).toHaveTextContent(money(15.66));
    expect(screen.getByText('tax').nextElementSibling).not.toHaveTextContent(money(12));
    expect(screen.getByTestId('checkout-originalGrossValue')).toHaveTextContent('originalGrossValue');
    expect(screen.getByTestId('checkout-originalGrossValue')).toHaveTextContent(money(98.11));
    expect(screen.getByTestId('checkout-yourSavings')).toHaveTextContent('yourSavings');
    expect(screen.getByTestId('checkout-yourSavings')).toHaveTextContent(money(16.11));
    expect(screen.getByTestId('checkout-grossValueOfGoods')).toHaveTextContent('grossValueOfGoods');
    expect(screen.getByTestId('checkout-grossValueOfGoods')).toHaveTextContent(money(82));
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-summary-shipping-vat')).toHaveTextContent(money(1.54));
    expect(screen.queryByText(/freight/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-promoCode')).toBeInTheDocument();
  });

  it('hides Gross Value of Goods when after-tax checkout has no discounted goods amount', () => {
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        hasAppliedCoupons: true,
        couponApplyBasis: 'gross',
        originalGoodsNet: 82.45,
        originalGoodsVat: 15.66,
        originalGoodsGross: 98.11,
        savingsTotal: 6.5,
        goodsNet: 82.45,
        goodsVat: 15.66,
        total: 119.24,
      }),
    );

    renderSummary();

    expect(screen.getByTestId('checkout-originalGrossValue')).toHaveTextContent(money(98.11));
    expect(screen.queryByTestId('checkout-grossValueOfGoods')).not.toBeInTheDocument();
  });

  it('removing the last code restores the no-coupon Value of goods row', () => {
    mockUseCheckoutPromoCode.mockReturnValue({
      code: '',
      setCode: jest.fn(),
      applying: false,
      removing: false,
      fieldError: null,
      apply: jest.fn(),
      remove: jest.fn(),
      discounts: [
        {
          code: 'ACCESSORIES15',
          name: '15% discount',
          discountIndex: 0,
          amount: 10,
          currency: 'CHF',
        },
      ],
    });
    mockUseCheckoutOrderSummary.mockReturnValue(
      breakdown({
        hasAppliedCoupons: true,
        originalGoodsNet: 100,
        savingsTotal: 10,
        goodsNet: 90,
        total: 119.24,
      }),
    );

    renderSummary();

    expect(screen.queryByText('valueOfGoods')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-originalValueOfGoods')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-yourSavings')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkout-removePromo-ACCESSORIES15'));

    cleanup();
    mockUseCheckoutPromoCode.mockReturnValue({
      code: '',
      setCode: jest.fn(),
      applying: false,
      removing: false,
      fieldError: null,
      apply: jest.fn(),
      remove: jest.fn(),
      discounts: [],
    });
    mockUseCheckoutOrderSummary.mockReturnValue(breakdown());
    renderSummary();

    expect(screen.getByText('valueOfGoods')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-originalValueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-yourSavings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-originalGrossValue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-grossValueOfGoods')).not.toBeInTheDocument();
  });
});
