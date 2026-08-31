/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PRODUCT_NO_IMAGE_SRC } from '@/lib/common/product-image';
import type { Order, OrderItem } from '@/platform/services/model/order/order';
import OrderConfirmation from './order-confirmation';

const useOrderMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : '-'),
  }),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({
    customer: null,
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/order/useOrder', () => ({
  useOrder: (...args: unknown[]) => useOrderMock(...args),
}));

function buildItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    productId: 'prod-1',
    name: 'Widget',
    quantity: 1,
    price: { value: 100, currency: 'CHF' },
    ...overrides,
  };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    status: 'CONFIRMED',
    createdAt: '2026-08-31T10:00:00.000Z',
    items: [buildItem()],
    currency: 'CHF',
    shipping: {
      total: { value: 20, currency: 'CHF' },
    },
    price: {
      subtotal: { net: 100, gross: 107.7, tax: 7.7, currency: 'CHF' },
      total: { net: 120, gross: 129.24, tax: 9.24, currency: 'CHF' },
    },
    ...overrides,
  };
}

/** Locale-tolerant money matcher (narrow/no-break spaces and `.` / `,` decimals). */
function money(amount: number): RegExp {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return new RegExp(`${whole}[.,]${fraction}`);
}

function mockUseOrder(order: Order) {
  useOrderMock.mockReturnValue({
    order,
    loading: false,
    error: null,
    statusTransitions: [],
    refetchOrder: jest.fn(),
    refetchStatusTransitions: jest.fn(),
  });
}

describe('OrderConfirmation empty thumbnail', () => {
  beforeEach(() => {
    useOrderMock.mockReset();
  });

  it('fills the image frame with no_image_alt when item.images[0] is missing', () => {
    mockUseOrder(buildOrder({ items: [buildItem({ images: undefined })] }));

    render(<OrderConfirmation orderId="order-1" />);

    const image = screen.getByRole('img', { name: 'product.noImage' });
    expect(image).toHaveAttribute('src', PRODUCT_NO_IMAGE_SRC);
    expect(image).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(image).toHaveClass('object-contain');
    expect(image.closest('.bg-surface-image-background')).toBeInTheDocument();
  });

  it('fills the image frame with no_image_alt when item.images is empty', () => {
    mockUseOrder(buildOrder({ items: [buildItem({ images: [] })] }));

    render(<OrderConfirmation orderId="order-1" />);

    const image = screen.getByRole('img', { name: 'product.noImage' });
    expect(image).toHaveAttribute('src', '/images/no_image_alt.png');
    expect(image).toHaveClass('object-contain');
    expect(image.closest('.bg-surface-image-background')).toBeInTheDocument();
  });

  it('renders the product image when item.images[0] is present', () => {
    mockUseOrder(
      buildOrder({
        items: [buildItem({ images: ['https://cdn.example.com/widget.jpg'] })],
      }),
    );

    render(<OrderConfirmation orderId="order-1" />);

    expect(screen.getByRole('img', { name: 'Widget' })).toHaveAttribute('src', 'https://cdn.example.com/widget.jpg');
    expect(screen.queryByRole('img', { name: 'product.noImage' })).not.toBeInTheDocument();
  });

  it('keeps confirmation shipping and total markup unchanged without Shipping VAT lines', () => {
    mockUseOrder(buildOrder());

    render(<OrderConfirmation orderId="order-1" />);

    const shippingRow = screen.getByText('orders.shipping').closest('div');
    expect(shippingRow).toHaveClass('flex', 'justify-between', 'mb-2');
    expect(shippingRow).toHaveTextContent(money(20));

    const totalRow = screen.getByText('orders.total').closest('div');
    expect(totalRow).toHaveClass('flex', 'justify-between', 'pt-2', 'border-t', 'border-border-primary');
    expect(totalRow).toHaveTextContent(money(129.24));

    expect(screen.queryByText(/shippingVat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shipping VAT/i)).not.toBeInTheDocument();
  });
});
