/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import deOrdersTranslations from '@/i18n/translations/de/orders/index.json';
import enOrdersTranslations from '@/i18n/translations/en/orders/index.json';
import type { Order } from '@/platform/services/model/order/order';
import { OrderDetail } from './order-detail';

const useOrderMock = jest.fn();
const cancelOrderMock = jest.fn();
const fetchReturnsForOrderMock = jest.fn();
const useProductsMock = jest.fn(() => ({
  products: [],
  loading: false,
  error: null,
  refetch: jest.fn(),
  setAsCurrent: jest.fn(),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({ addItem: jest.fn(), loading: false }),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({ availableSites: [] }),
}));

jest.mock('next-intl', () => ({
  // Two consumers need useLocale(): useL10n for the item name (the fixture carries
  // plain strings, so l10n passes them through) and the order/delivery date, which
  // is asserted in the active locale.
  useLocale: () => 'en',
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.has = () => false;
    return translate;
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/order/useOrder', () => ({
  useOrder: (...args: unknown[]) => useOrderMock(...args),
}));

jest.mock('@/hooks/product/useProducts', () => ({
  useProducts: (...args: any[]) => (useProductsMock as (...a: any[]) => unknown)(...args),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : ''),
  }),
}));

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/account/orders/order-status-badge', () => ({
  OrderStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

jest.mock('@/components/account/orders/create-return-dialog', () => ({
  CreateReturnDialog: () => null,
}));

jest.mock('@/lib/client/returns', () => ({
  fetchReturnsForOrder: (...args: unknown[]) => fetchReturnsForOrderMock(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

const baseOrder: Order = {
  id: 'order-1',
  status: 'CREATED',
  createdAt: '2026-05-31T10:00:00.000Z',
  customerEmail: 'buyer@example.com',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      name: 'Sample Product',
      quantity: 2,
      price: { value: 50, netValue: 42, grossValue: 50, currency: 'EUR' },
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      name: 'Legacy Priced Product',
      quantity: 1,
      price: { value: 30, currency: 'EUR' },
    },
  ],
  currency: 'EUR',
  price: {
    subtotal: { net: 100, gross: 119, tax: 19, currency: 'EUR' },
    total: { net: 100, gross: 119, tax: 19, currency: 'EUR' },
  },
};

function mockUseOrder(overrides: Partial<ReturnType<typeof useOrderMock>> = {}) {
  useOrderMock.mockReturnValue({
    order: baseOrder,
    loading: false,
    error: null,
    cancelOrder: cancelOrderMock,
    statusTransitions: [],
    ...overrides,
  });
}

describe('OrderDetail', () => {
  beforeEach(() => {
    useOrderMock.mockReset();
    cancelOrderMock.mockReset();
    fetchReturnsForOrderMock.mockReset();
    fetchReturnsForOrderMock.mockResolvedValue([]);
    useProductsMock.mockReset();
    useProductsMock.mockReturnValue({
      products: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      setAsCurrent: jest.fn(),
    });
  });

  it('shows a loading skeleton while the order is loading', () => {
    useOrderMock.mockReturnValue({
      order: null,
      loading: true,
      error: null,
      cancelOrder: undefined,
      statusTransitions: [],
    });

    const { container } = render(<OrderDetail orderId="order-1" />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows an error message when the order fails to load', () => {
    useOrderMock.mockReturnValue({
      order: null,
      loading: false,
      error: new Error('boom'),
      cancelOrder: undefined,
      statusTransitions: [],
    });

    render(<OrderDetail orderId="order-1" />);

    expect(screen.getByText('errorFetchingOrder')).toBeInTheDocument();
  });

  it('renders Net value of goods and Total without Gross secondary lines, Total from price.total.gross', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const overviewCard = screen.getByTestId('order-overview-totals');

    expect(overviewCard).toHaveTextContent('100 EUR');
    expect(overviewCard).toHaveTextContent('119 EUR');
    expect(overviewCard).not.toHaveTextContent('gross:');
    // Total display is model gross only — not net.
    const totalRow = screen.getByTestId('order-totalValue').parentElement;
    expect(totalRow).toHaveTextContent('totalValue');
    expect(totalRow).toHaveTextContent('119 EUR');
    expect(totalRow).not.toHaveTextContent('100 EUR');
  });

  it('characterizes Total gross against Net+VAT when Shipping VAT is absent', () => {
    const { price } = baseOrder;
    expect(price).toBeDefined();
    const lineSum = price!.subtotal.net + price!.total.tax;
    expect(price!.total.gross).toBe(lineSum);

    mockUseOrder();
    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const overviewCard = screen.getByTestId('order-overview-totals');
    const totalRow = screen.getByTestId('order-totalValue').parentElement;
    expect(totalRow).toHaveTextContent(`${price!.total.gross} EUR`);
  });

  it('renders the product list unit price with the net value primary and gross as the secondary value', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    // Item with both net/gross values available shows the net value primary, gross secondary.
    expect(screen.getAllByText('€42.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('gross €50.00').length).toBeGreaterThanOrEqual(1);

    // Item without net/gross falls back to the existing single value.
    expect(screen.getAllByText('€30.00').length).toBeGreaterThanOrEqual(1);
  });

  it('omits Related Quote when no quoteId exists', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('relatedQuote')).not.toBeInTheDocument();
  });

  it('renders Related Quote in the Order Details summary when quoteId is present, not in Overview', () => {
    const orderWithQuote = { ...baseOrder, quoteId: 'Q-1000' };
    mockUseOrder({ order: orderWithQuote });

    render(<OrderDetail orderId={orderWithQuote.id} initialOrder={orderWithQuote} />);

    expect(screen.getByText('relatedQuote')).toBeInTheDocument();
    const quoteLink = screen.getByRole('link', { name: '#Q-1000' });
    expect(quoteLink).toHaveAttribute('href', '/account/quotes/Q-1000');

    const overviewCard = screen.getByTestId('order-overview-totals');
    expect(overviewCard).not.toHaveTextContent('relatedQuote');
    expect(overviewCard).not.toContainElement(quoteLink);
  });

  it('shows the cancel order button only when CREATED and DECLINED transition is allowed', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getByText('cancelOrder')).toBeInTheDocument();
  });

  it('opens a cancel confirmation dialog without cancelling immediately', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelOrder/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('cancelOrderConfirmTitle')).toBeInTheDocument();
    expect(screen.getByText('cancelOrderConfirmDescription')).toBeInTheDocument();
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it('keep-order dismiss closes the dialog and does not cancel', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelOrder/ }));
    fireEvent.click(screen.getByRole('button', { name: 'keepOrder' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it('confirm cancels exactly once and closes the dialog', async () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });
    cancelOrderMock.mockResolvedValue(undefined);

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelOrder/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancelOrderConfirm' }));

    await waitFor(() => expect(cancelOrderMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('disables confirm and blocks duplicate cancel while the mutation is pending', async () => {
    let resolveCancel: () => void = () => {};
    cancelOrderMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCancel = resolve;
        }),
    );
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelOrder/ }));
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'cancelOrderConfirm' });

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(cancelOrderMock).toHaveBeenCalledTimes(1);
    expect(confirmButton).toBeDisabled();

    await act(async () => {
      resolveCancel();
    });
  });

  it('hides the cancel order button when the DECLINED transition is not allowed', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: [] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('cancelOrder')).not.toBeInTheDocument();
  });

  it('shows the return order button only for COMPLETED orders', async () => {
    const completedOrder = { ...baseOrder, status: 'COMPLETED' as const };
    mockUseOrder({ order: completedOrder });

    render(<OrderDetail orderId={completedOrder.id} initialOrder={completedOrder} />);
    await act(async () => {
      await fetchReturnsForOrderMock.mock.results.at(-1)?.value;
    });

    expect(screen.getByText('returnOrder')).toBeInTheDocument();
  });

  it('shows an enabled Track Shipment control for shipped-lifecycle statuses', () => {
    const shippedOrder = { ...baseOrder, status: 'SHIPPED' as const };
    mockUseOrder({ order: shippedOrder });

    render(<OrderDetail orderId={shippedOrder.id} initialOrder={shippedOrder} />);

    const trackButton = screen.getByTestId('order-trackShipmentButton');
    expect(trackButton).toHaveTextContent('trackOrder');
    expect(trackButton).toBeEnabled();
  });

  it('hides the Track Shipment control for statuses outside the tracking lifecycle', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' } });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByTestId('order-trackShipmentButton')).not.toBeInTheDocument();
  });

  it('links the product name to its product page, preserving product navigation', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getAllByRole('link', { name: 'Sample Product' })[0]).toHaveAttribute('href', '/product/prod-1');
  });

  it('renders the optional vendor name above the product name only when present', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], vendorName: 'Acme Vendor' }, baseOrder.items[1]],
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const vendorName = screen.getByText('Acme Vendor');
    const productName = screen.getByRole('link', { name: 'Sample Product' });
    expect(vendorName.compareDocumentPosition(productName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('order-item-item-2')).not.toHaveTextContent('Acme Vendor');
  });

  it('fills brand from catalog when order line has no vendorName', () => {
    useProductsMock.mockReturnValue({
      products: [
        {
          id: baseOrder.items[0].productId,
          brand: { id: 'victron', name: 'Victron Energy' },
          name: 'BlueSolar 55 W',
          images: [],
        },
      ] as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
      setAsCurrent: jest.fn(),
    });

    mockUseOrder({
      order: {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], vendorName: undefined }],
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getAllByText('Victron Energy').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render an Order date or Subtotal row in the Order Overview card', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const overviewCard = screen.getByTestId('order-overview-totals');

    expect(overviewCard).not.toHaveTextContent('orderDate');
    expect(overviewCard).not.toHaveTextContent('subtotal');
  });

  it('renders the order date in the active locale, not in English', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getByText('05/31/2026')).toBeInTheDocument();
  });

  it('renders the expected delivery date in the active locale, not in English', () => {
    // The second formatDate call site: without a fixture that sets the field, the branch never runs.
    mockUseOrder({ order: { ...baseOrder, expectedDeliveryDate: '2026-06-02T10:00:00.000Z' } });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getByText('06/02/2026')).toBeInTheDocument();
  });

  it('renders the Order Overview rows in the exact required sequence: Net value of goods, VAT, Shipping fee, Total value', () => {
    const orderWithShipping = {
      ...baseOrder,
      shipping: {
        methods: [{ id: 'pickup', name: 'Pickup', price: 5, currency: 'EUR' }],
        total: { value: 5, currency: 'EUR' },
      },
    };
    mockUseOrder({ order: orderWithShipping });

    render(<OrderDetail orderId={orderWithShipping.id} initialOrder={orderWithShipping} />);

    const overviewCard = screen.getByTestId('order-overview-totals');
    const text = overviewCard?.textContent ?? '';

    const netValueOfGoodsIndex = text.indexOf('netValueOfGoods');
    const vatIndex = text.indexOf('tax');
    const shippingFeeIndex = text.indexOf('shippingFee');
    const totalValueIndex = text.indexOf('totalValue');

    expect(netValueOfGoodsIndex).toBeGreaterThanOrEqual(0);
    expect(vatIndex).toBeGreaterThan(netValueOfGoodsIndex);
    expect(shippingFeeIndex).toBeGreaterThan(vatIndex);
    expect(totalValueIndex).toBeGreaterThan(shippingFeeIndex);
  });

  it('renders a net-applied coupon box and savings without a remove control', () => {
    const netCouponOrder: Order = {
      ...baseOrder,
      discounts: [
        { code: 'TOTAL', value: 101.1, currency: 'EUR', description: '10% off order' },
        { code: '10POFF', value: 101.1, currency: 'EUR' },
      ],
      savingsTotal: 101.1,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      includesTax: false,
      goodsDiscountedNet: 909.89,
      goodsDiscountedVat: 172.88,
      goodsDiscountedGross: 1082.77,
      price: {
        subtotal: { net: 1010.99, gross: 1203.08, tax: 192.09, currency: 'EUR', taxRate: 19 },
        total: { net: 909.89, gross: 1082.77, tax: 172.88, currency: 'EUR' },
      },
    };
    mockUseOrder({ order: netCouponOrder });

    render(<OrderDetail orderId={netCouponOrder.id} initialOrder={netCouponOrder} />);

    const overviewCard = screen.getByTestId('order-overview-totals');
    const tenOffChip = screen.getByTestId('order-appliedPromo-10POFF');

    expect(screen.queryByTestId('order-appliedPromo-TOTAL')).not.toBeInTheDocument();
    expect(tenOffChip).toHaveTextContent('10POFF');
    expect(tenOffChip).toHaveTextContent('-101.1 EUR');
    expect(screen.getByTestId('order-appliedPromoAmount-10POFF')).toHaveTextContent('-101.1 EUR');
    expect(tenOffChip.querySelector('p.font-bold')).toBeNull();
    expect(within(tenOffChip).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-removePromo-TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-removePromo-TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-applyPromo')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-originalValueOfGoods')).toHaveTextContent('originalValueOfGoods');
    expect(screen.getByTestId('order-originalValueOfGoods')).toHaveTextContent('1010.99 EUR');
    expect(screen.getByTestId('order-yourSavings')).toHaveTextContent('yourSavings');
    expect(screen.getByTestId('order-yourSavings')).toHaveTextContent('-101.1 EUR');
    expect(screen.getByTestId('order-yourSavings')).toHaveClass('text-sm');
    expect(overviewCard).toHaveTextContent('909.89 EUR');
    expect(overviewCard).toHaveTextContent('172.88 EUR');
    expect(overviewCard).not.toHaveTextContent('192.09 EUR');
    expect(screen.queryByTestId('order-originalGrossValue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-grossValueOfGoods')).not.toBeInTheDocument();
    expect(overviewCard).not.toHaveTextContent('discount');
    expect(overviewCard).not.toHaveTextContent(/freight/i);
    expect(enOrdersTranslations.yourSavings).toBe('Your savings');
    expect(enOrdersTranslations.originalValueOfGoods).toBe('Original value of goods');
    expect(deOrdersTranslations.yourSavings).toBe('Ihre Ersparnis');
    expect(enOrdersTranslations.promoFreeShipping).toBe('Free shipping');
    expect(deOrdersTranslations.promoFreeShipping).toBe('Kostenloser Versand');
  });

  it('keeps a zero-amount free-shipping coupon on Order Overview and labels it Free shipping', () => {
    const freeShippingOrder: Order = {
      ...baseOrder,
      discounts: [
        { code: 'TOTAL', value: 0, currency: 'EUR' },
        { code: 'VKTEST-COUPON05', value: 0, currency: 'EUR', type: 'FREE_SHIPPING' },
        { code: 'NOMATCH', value: 0, currency: 'EUR', type: 'PERCENT' },
      ],
      shipping: { total: { value: 0, currency: 'EUR', tax: 0, taxRate: 19 } },
    };
    mockUseOrder({ order: freeShippingOrder });

    render(<OrderDetail orderId={freeShippingOrder.id} initialOrder={freeShippingOrder} />);

    const chip = screen.getByTestId('order-appliedPromo-VKTEST-COUPON05');
    expect(chip).toHaveTextContent('VKTEST-COUPON05');
    expect(screen.getByTestId('order-appliedPromoAmount-VKTEST-COUPON05')).toHaveTextContent('promoFreeShipping');
    expect(chip).not.toHaveTextContent('-0');
    expect(screen.queryByTestId('order-appliedPromo-TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-appliedPromo-NOMATCH')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-yourSavings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-originalValueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-originalGrossValue')).not.toBeInTheDocument();
  });

  it('hides Your savings when savingsTotal is zero', () => {
    const zeroSavingsOrder: Order = {
      ...baseOrder,
      discounts: [{ code: 'VKTEST-COUPON05', value: 0, currency: 'EUR', type: 'FREE_SHIPPING' }],
      savingsTotal: 0,
    };
    mockUseOrder({ order: zeroSavingsOrder });

    render(<OrderDetail orderId={zeroSavingsOrder.id} initialOrder={zeroSavingsOrder} />);

    expect(screen.getByTestId('order-appliedPromo-VKTEST-COUPON05')).toBeInTheDocument();
    expect(screen.queryByTestId('order-yourSavings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-originalValueOfGoods')).not.toBeInTheDocument();
  });

  it('renders a gross-applied coupon box with pre-discount VAT and no remove control', () => {
    const grossCouponOrder: Order = {
      ...baseOrder,
      discounts: [{ code: 'GROSS10', value: 16.11, currency: 'EUR', description: 'After-tax 10%' }],
      savingsTotal: 16.11,
      totalDiscountCalculationType: 'ApplyDiscountAfterTax',
      includesTax: true,
      goodsDiscountedNet: 70,
      goodsDiscountedVat: 12,
      goodsDiscountedGross: 82,
      price: {
        subtotal: { net: 82.45, gross: 98.11, tax: 15.66, currency: 'EUR' },
        total: { net: 70, gross: 86.95, tax: 12, currency: 'EUR' },
      },
    };
    mockUseOrder({ order: grossCouponOrder });

    render(<OrderDetail orderId={grossCouponOrder.id} initialOrder={grossCouponOrder} />);

    const overviewCard = screen.getByTestId('order-overview-totals');
    const chip = screen.getByTestId('order-appliedPromo-GROSS10');

    expect(chip).toHaveTextContent('GROSS10');
    expect(chip).toHaveTextContent('After-tax 10%');
    expect(within(chip).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-removePromo-GROSS10')).not.toBeInTheDocument();
    expect(overviewCard).toHaveTextContent('valueOfGoods');
    expect(overviewCard).toHaveTextContent('82.45 EUR');
    expect(overviewCard).toHaveTextContent('15.66 EUR');
    expect(overviewCard).not.toHaveTextContent('12 EUR');
    expect(screen.getByTestId('order-originalGrossValue')).toHaveTextContent('originalGrossValue');
    expect(screen.getByTestId('order-originalGrossValue')).toHaveTextContent('98.11 EUR');
    expect(screen.getByTestId('order-yourSavings')).toHaveTextContent('yourSavings');
    expect(screen.getByTestId('order-yourSavings')).toHaveTextContent('-16.11 EUR');
    expect(screen.getByTestId('order-grossValueOfGoods')).toHaveTextContent('grossValueOfGoods');
    expect(screen.getByTestId('order-grossValueOfGoods')).toHaveTextContent('82 EUR');
    expect(screen.queryByTestId('order-originalValueOfGoods')).not.toBeInTheDocument();
    expect(overviewCard).not.toHaveTextContent('discount');
    expect(enOrdersTranslations.originalGrossValue).toBe('Original Gross Value');
    expect(enOrdersTranslations.grossValueOfGoods).toBe('Gross Value of Goods');
    expect(deOrdersTranslations.originalGrossValue).toBe('Ursprünglicher Bruttowert');
    expect(deOrdersTranslations.grossValueOfGoods).toBe('Brutto-Warenwert');
  });

  it('hides Gross Value of Goods when after-tax orders have no discounted goods amount', () => {
    const shippingOnlyCouponOrder: Order = {
      ...baseOrder,
      discounts: [
        { code: 'SHIPFREE', value: 6.5, currency: 'EUR', description: 'Free shipping', type: 'FREE_SHIPPING' },
      ],
      savingsTotal: 6.5,
      totalDiscountCalculationType: 'ApplyDiscountAfterTax',
      includesTax: true,
    };
    mockUseOrder({ order: shippingOnlyCouponOrder });

    render(<OrderDetail orderId={shippingOnlyCouponOrder.id} initialOrder={shippingOnlyCouponOrder} />);

    expect(screen.queryByTestId('order-originalGrossValue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-grossValueOfGoods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-yourSavings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-originalValueOfGoods')).not.toBeInTheDocument();
  });

  it('omits an optional Shipping VAT row when the order model has no independent shipping-tax value', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText(/shippingVat/)).not.toBeInTheDocument();
  });

  it('omits Shipping VAT when shipping tax rate is 0%', () => {
    const orderWithZeroShippingTax: Order = {
      ...baseOrder,
      shipping: {
        methods: [{ id: 'pickup', name: 'Pickup', price: 3.45, currency: 'EUR' }],
        total: { value: 3.45, currency: 'EUR', tax: 0, taxRate: 0 },
      },
    };
    mockUseOrder({ order: orderWithZeroShippingTax });

    render(<OrderDetail orderId={orderWithZeroShippingTax.id} initialOrder={orderWithZeroShippingTax} />);

    expect(screen.getByText('shippingFee')).toBeInTheDocument();
    expect(screen.queryByText(/shippingVat/)).not.toBeInTheDocument();
  });

  it('strikes the method list fee when the published shipping total is lower', () => {
    const discountedShippingOrder: Order = {
      ...baseOrder,
      shipping: {
        methods: [{ id: 'super', name: 'Super Shipping', price: 1.75, currency: 'CHF' }],
        total: { value: 1.57, currency: 'CHF' },
      },
    };
    mockUseOrder({ order: discountedShippingOrder });

    render(<OrderDetail orderId={discountedShippingOrder.id} initialOrder={discountedShippingOrder} />);

    const compare = screen.getByTestId('order-shippingFeeCompare');
    expect(compare.querySelector('.line-through')).toHaveTextContent('1.75 CHF');
    expect(compare).toHaveTextContent('1.57 CHF');
  });

  it('omits Shipping VAT when tax amount is 0 even if rate is positive (free shipping)', () => {
    const orderWithFreeShippingTaxRate: Order = {
      ...baseOrder,
      shipping: {
        methods: [{ id: 'free', name: 'Free', price: 0, currency: 'EUR' }],
        total: { value: 0, currency: 'EUR', tax: 0, taxRate: 7 },
      },
    };
    mockUseOrder({ order: orderWithFreeShippingTaxRate });

    render(<OrderDetail orderId={orderWithFreeShippingTaxRate.id} initialOrder={orderWithFreeShippingTaxRate} />);

    expect(screen.getByText('shippingFee')).toBeInTheDocument();
    expect(screen.queryByText(/shippingVat/)).not.toBeInTheDocument();
    expect(screen.queryByText(/7%/)).not.toBeInTheDocument();
  });

  it('renders Shipping VAT from the model tax field and Total from price.total.gross only', () => {
    const orderWithShippingTax: Order = {
      ...baseOrder,
      price: {
        subtotal: { net: 100, gross: 119, tax: 19, currency: 'EUR', taxRate: 19 },
        total: { net: 100, gross: 129.71, tax: 19, currency: 'EUR' },
      },
      shipping: {
        methods: [{ id: 'std', name: 'Standard', price: 9, currency: 'EUR' }],
        total: { value: 9, currency: 'EUR', tax: 1.71, taxRate: 19 },
      },
    };

    const lineSum =
      orderWithShippingTax.price!.subtotal.net +
      orderWithShippingTax.price!.subtotal.tax +
      orderWithShippingTax.shipping!.total.value +
      (orderWithShippingTax.shipping!.total.tax ?? 0);
    expect(orderWithShippingTax.price!.total.gross).toBe(lineSum);

    mockUseOrder({ order: orderWithShippingTax });

    render(<OrderDetail orderId={orderWithShippingTax.id} initialOrder={orderWithShippingTax} />);

    expect(screen.getByText('shippingVat (19%)')).toBeInTheDocument();
    expect(screen.getByText('1.71 EUR')).toBeInTheDocument();
    expect(screen.getByText('tax (19%)')).toBeInTheDocument();

    const overviewCard = screen.getByTestId('order-overview-totals');
    const totalRow = screen.getByTestId('order-totalValue').parentElement;
    expect(totalRow).toHaveTextContent('129.71 EUR');
    expect(overviewCard).not.toHaveTextContent('gross:');
  });

  it('shows goods and shipping VAT percents independently when rates differ', () => {
    const splitRates: Order = {
      ...baseOrder,
      price: {
        subtotal: { net: 100, gross: 107.7, tax: 7.7, currency: 'CHF', taxRate: 7.7 },
        total: { net: 120, gross: 128.44, tax: 8.44, currency: 'CHF' },
      },
      shipping: {
        methods: [{ id: 'fw', name: 'Super Shipping', price: 20, currency: 'CHF' }],
        total: { value: 20, currency: 'CHF', tax: 0.74, taxRate: 3.7 },
      },
    };
    mockUseOrder({ order: splitRates });

    render(<OrderDetail orderId={splitRates.id} initialOrder={splitRates} />);

    expect(screen.getByText('tax (7.7%)')).toBeInTheDocument();
    expect(screen.getByText('shippingVat (3.7%)')).toBeInTheDocument();
  });

  it('shows VAT without a derived percent when goods taxRate is omitted (mixed rates)', () => {
    const mixedRates: Order = {
      ...baseOrder,
      price: {
        subtotal: { net: 7942, gross: 8517.74, tax: 575.74, currency: 'EUR' },
        total: { net: 7942, gross: 8517.74, tax: 575.74, currency: 'EUR' },
      },
    };
    mockUseOrder({ order: mixedRates });

    render(<OrderDetail orderId={mixedRates.id} initialOrder={mixedRates} />);

    expect(screen.getByText('tax')).toBeInTheDocument();
    expect(screen.queryByText(/tax \(\d+%\)/)).not.toBeInTheDocument();
  });

  it('renders the Shipping address label instead of Transport/Delivery address', () => {
    const orderWithShippingAddress = {
      ...baseOrder,
      shippingAddress: {
        contactName: 'Jane Buyer',
        street: 'Main St',
        streetNumber: '1',
        zipCode: '12345',
        city: 'Berlin',
        country: 'DE',
      },
    };
    mockUseOrder({ order: orderWithShippingAddress });

    const { container } = render(
      <OrderDetail orderId={orderWithShippingAddress.id} initialOrder={orderWithShippingAddress} />,
    );

    expect(screen.queryByText('transport')).not.toBeInTheDocument();
    expect(screen.getByText('shippingAddress')).toBeInTheDocument();
    expect(screen.queryByText('deliveryAddress')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('Jane Buyer');
  });

  it('does not render a Contact card', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('contact')).not.toBeInTheDocument();
  });
});
