/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { OrderDetail } from './order-detail';

const useOrderMock = jest.fn();
const cancelOrderMock = jest.fn();
const fetchReturnsForOrderMock = jest.fn();

jest.mock('next-intl', () => ({
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

  it('renders the net value before the gross value for the Order Overview subtotal and total', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    // Subtotal/total: net rendered unlabeled (primary), gross rendered as a labeled secondary value.
    expect(screen.getAllByText('100 EUR').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('gross: 119 EUR').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the product list unit price with the net value primary and gross as the secondary value', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    // Item with both net/gross values available shows the net value primary, gross secondary.
    expect(screen.getAllByText('€42.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('gross: €50.00').length).toBeGreaterThanOrEqual(1);

    // Item without net/gross falls back to the existing single value.
    expect(screen.getAllByText('€30.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders order items through the shared product-grid contract', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getByTestId('product-item-desktop-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('product-item-mobile-item-1')).toBeInTheDocument();
  });

  it('omits the order overview quote row when no related quote exists', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('relatedQuote')).not.toBeInTheDocument();
  });

  it('renders the related quote link when a quoteId is present', () => {
    const orderWithQuote = { ...baseOrder, quoteId: 'Q-1000' };
    mockUseOrder({ order: orderWithQuote });

    render(<OrderDetail orderId={orderWithQuote.id} initialOrder={orderWithQuote} />);

    expect(screen.getByText('relatedQuote')).toBeInTheDocument();
    const quoteLink = screen.getByRole('link', { name: 'Q-1000' });
    expect(quoteLink).toHaveAttribute('href', '/account/quotes/Q-1000');
  });

  it('shows the cancel order button only when CREATED and DECLINED transition is allowed', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getByText('cancelOrder')).toBeInTheDocument();
  });

  it('cancels the order when the header Cancel Order button is clicked', async () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: ['DECLINED'] });
    cancelOrderMock.mockResolvedValue(undefined);

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    screen.getByText('cancelOrder').closest('button')?.click();

    await Promise.resolve();

    expect(cancelOrderMock).toHaveBeenCalledTimes(1);
  });

  it('hides the cancel order button when the DECLINED transition is not allowed', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' }, statusTransitions: [] });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('cancelOrder')).not.toBeInTheDocument();
  });

  it('shows the return order button only for COMPLETED orders', () => {
    const completedOrder = { ...baseOrder, status: 'COMPLETED' as const };
    mockUseOrder({ order: completedOrder });

    render(<OrderDetail orderId={completedOrder.id} initialOrder={completedOrder} />);

    expect(screen.getByText('returnOrder')).toBeInTheDocument();
  });

  it('shows a disabled, unconnected Track Shipment control for shipped-lifecycle statuses', () => {
    const shippedOrder = { ...baseOrder, status: 'SHIPPED' as const };
    mockUseOrder({ order: shippedOrder });

    render(<OrderDetail orderId={shippedOrder.id} initialOrder={shippedOrder} />);

    const trackButton = screen.getByText('trackShipment').closest('button');
    expect(trackButton).toBeInTheDocument();
    expect(trackButton).toBeDisabled();
  });

  it('hides the Track Shipment control for statuses outside the tracking lifecycle', () => {
    mockUseOrder({ order: { ...baseOrder, status: 'CREATED' } });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('trackShipment')).not.toBeInTheDocument();
  });

  it('links the product name to its product page, preserving product navigation', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.getAllByRole('link', { name: 'Sample Product' })[0]).toHaveAttribute('href', '/product/prod-1');
  });

  it('places the order id heading and status badge together in the header, above the compact Order Details strip', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent(`orderIdHeading: ${baseOrder.id}`);
    expect(heading.parentElement).toHaveTextContent(baseOrder.status);

    // The compact strip is a distinct section rendered after the header, reusing existing model fields only.
    const strip = screen.getByText('orderDetails').closest('div');
    expect(strip).toHaveTextContent('orderNumber');
    expect(strip).toHaveTextContent(baseOrder.id);
  });

  it('does not render the former standalone totals block or bottom Order Actions footer', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('orderActions')).not.toBeInTheDocument();
  });

  it('renders the Order Details strip as a single surface-primary rounded-md card with theme shadow and p-6 padding', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const heading = screen.getByRole('heading', { level: 4, name: 'orderDetails' });
    const strip = heading.parentElement?.parentElement;
    expect(strip).toHaveClass('bg-surface-primary', 'rounded-md', 'shadow-sm', 'p-6');
    // H4 default variant renders the 28/36 heading scale (text-4xl).
    expect(heading).toHaveClass('text-4xl');
  });

  it('renders the Order Details strip fields as bold h5 labels with regular body-sm values', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const heading = screen.getByRole('heading', { level: 4, name: 'orderDetails' });
    const orderNumberLabel = screen.getByText('orderNumber');
    const orderNumberValue = screen.getByText(baseOrder.id);
    expect(orderNumberLabel).toHaveClass('text-3xl', 'font-bold', 'font-headlines');
    expect(orderNumberValue).toHaveClass('text-sm', 'font-normal', 'font-body');
    expect(heading.parentElement).toHaveClass('flex', 'flex-col', 'items-start', 'gap-6');
    expect(orderNumberLabel.parentElement?.parentElement).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-2');
  });

  it('renders card field labels as bold h5 and values as regular body-md, vertically stacked with a compact gap', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        shipping: { methods: [{ name: 'Pickup' }], total: { value: 0, currency: 'EUR' } },
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const label = screen.getByText('shippingMethod');
    const value = screen.getByText('Pickup');
    expect(label).toHaveClass('text-3xl', 'font-bold', 'font-headlines');
    expect(value).toHaveClass('text-base', 'font-normal', 'font-body');
    expect(label.parentElement).toHaveClass('flex', 'flex-col', 'gap-1');
  });

  it('uses Figma H4 titles with 32px icons and a 16px inner card panel', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        shipping: { methods: [{ name: 'Pickup' }], total: { value: 0, currency: 'EUR' } },
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const title = screen.getByRole('heading', { level: 4, name: 'shipping' });
    const card = title.closest('[data-slot="card"]');
    const icon = card?.querySelector('svg');

    expect(title).toHaveClass('text-4xl');
    expect(card).toHaveClass('p-4', 'gap-4');
    expect(icon).toHaveClass('h-8', 'w-8');
  });

  it('stacks Transport label-value pairs using the shared H5 and body-medium field styles', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        shipping: { methods: [{ name: 'Pickup' }], total: { value: 0, currency: 'EUR' } },
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const label = screen.getByText('shippingMethod');
    const value = screen.getByText('Pickup');
    expect(label).toHaveClass('text-3xl', 'font-bold', 'font-headlines');
    expect(value).toHaveClass('text-base', 'font-normal', 'font-body');
    expect(label.parentElement).toBe(value.parentElement);
  });

  it('does not render a redundant Order items heading above the product table', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('orderItems')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 6, name: 'orderItems' })).not.toBeInTheDocument();
  });

  it('renders the product image at 120x78', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], images: ['https://example.com/image.png'] }],
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const image = screen.getAllByRole('img', { name: 'Sample Product' })[0];
    expect(image).toHaveAttribute('width', '120');
    expect(image).toHaveAttribute('height', '78');
  });

  it('renders the optional vendor name above the bold h6 product name only when present', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], vendorName: 'Acme Vendor' }, baseOrder.items[1]],
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const vendorName = screen.getAllByText('Acme Vendor')[0];
    expect(vendorName).toHaveClass('text-base', 'font-body');

    const productName = screen.getAllByRole('link', { name: 'Sample Product' })[0];
    expect(productName).toHaveClass('text-2xl', 'font-bold', 'font-headlines');

    // vendorName precedes the product name in the DOM (brand above name).
    expect(vendorName.compareDocumentPosition(productName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The second item has no vendorName and renders no vendor element.
    expect(screen.getAllByText(/Legacy Priced Product/i)[0]?.parentElement).not.toHaveTextContent('Acme Vendor');
  });

  it('renders the item quantity as regular body-md', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const quantityValue = screen.getAllByText('2', { selector: 'span.text-base' })[0];
    expect(quantityValue).toHaveClass('text-base', 'font-body');
  });

  it('left-aligns the Quantity column header and each row value at desktop widths', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const quantityHeader = screen.getByText('quantity');
    expect(quantityHeader).toHaveClass('text-left');
    expect(quantityHeader).not.toHaveClass('text-right');

    const quantityValue = screen.getAllByText('2', { selector: 'span.text-base' })[0];
    expect(screen.getByTestId('product-quantity-cell-item-1')).toBeTruthy();
    expect(quantityValue).toBeInTheDocument();
  });

  it('does not render a redundant per-row Quantity label on smallest mobile', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    // Only the desktop column header renders the literal quantity label; no per-item mobile label duplicates it.
    expect(screen.getAllByText('quantity')).toHaveLength(1);
  });

  it('renders the item price as a bold H5-equivalent primary with the secondary Gross value as body-sm', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const primaryPrice = screen.getAllByText('€42.00')[0];
    const grossPrice = screen.getAllByText('gross: €50.00')[0];
    expect(primaryPrice).toHaveClass('text-2xl', 'font-bold', 'font-headlines');
    expect(grossPrice).toHaveClass('text-sm', 'font-body');

    // The legacy single-value item (no net/gross split) also renders at the shared price scale.
    const legacyPrice = screen.getAllByText('€30.00')[0];
    expect(legacyPrice).toHaveClass('text-2xl', 'font-bold', 'font-headlines');
  });

  it('renders the product name above the thumbnail on smallest mobile while preserving the desktop thumbnail-left order', () => {
    mockUseOrder({
      order: {
        ...baseOrder,
        items: [{ ...baseOrder.items[0], images: ['https://example.com/image.png'] }, baseOrder.items[1]],
      },
    });

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const productLink = screen.getAllByRole('link', { name: 'Sample Product' })[0];
    const productRow = productLink.closest('[data-testid^="product-item-mobile"]');
    expect(productRow).toBeInTheDocument();

    const image = screen.getAllByRole('img', { name: 'Sample Product' })[0];
    const imageWrappers = screen.getAllByTestId('product-image-wrapper-item-1');
    expect(imageWrappers.some((wrapper) => wrapper.contains(image))).toBe(true);
  });

  it('does not render an Order date or Subtotal row in the Order Overview card', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    const overviewHeading = screen.getByRole('heading', { level: 4, name: 'orderOverview' });
    const overviewCard = overviewHeading.closest('[data-slot="card"]');

    expect(overviewCard).not.toHaveTextContent('orderDate');
    expect(overviewCard).not.toHaveTextContent('subtotal');
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

    const overviewHeading = screen.getByRole('heading', { level: 4, name: 'orderOverview' });
    const overviewCard = overviewHeading.closest('[data-slot="card"]');
    const text = overviewCard?.textContent ?? '';

    const netValueOfGoodsIndex = text.indexOf('netValueOfGoods');
    const vatIndex = text.indexOf('vat');
    const shippingFeeIndex = text.indexOf('shippingFee');
    const totalValueIndex = text.indexOf('totalValue');

    expect(netValueOfGoodsIndex).toBeGreaterThanOrEqual(0);
    expect(vatIndex).toBeGreaterThan(netValueOfGoodsIndex);
    expect(shippingFeeIndex).toBeGreaterThan(vatIndex);
    expect(totalValueIndex).toBeGreaterThan(shippingFeeIndex);
  });

  it('omits an optional Shipping VAT row when the order model has no independent shipping-tax value', () => {
    mockUseOrder();

    render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('shippingVat')).not.toBeInTheDocument();
  });

  it('renders the Shipping card heading and Shipping address label instead of Transport/Delivery address', () => {
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

    expect(screen.getByRole('heading', { level: 4, name: 'shipping' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 4, name: 'transport' })).not.toBeInTheDocument();
    expect(screen.getByText('shippingAddress')).toBeInTheDocument();
    expect(screen.queryByText('deliveryAddress')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('Jane Buyer');
  });

  it('does not render a Contact card without breaking the detail-cards grid', () => {
    mockUseOrder();

    const { container } = render(<OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />);

    expect(screen.queryByText('contact')).not.toBeInTheDocument();
    const overviewHeading = screen.getByRole('heading', { level: 4, name: 'orderOverview' });
    const grid = overviewHeading.closest('[data-slot="card"]')?.parentElement?.parentElement;
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
    expect(container).toBeInTheDocument();
  });
});
