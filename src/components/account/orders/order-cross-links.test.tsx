/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { OrderDetail } from './order-detail';
import { OrdersTable } from './orders-table';

const useOrderMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.has = () => false;
    return translate;
  },
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/order/useOrder', () => ({
  useOrder: (...args: unknown[]) => useOrderMock(...args),
}));

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('@/components/account/orders/order-status-badge', () => ({
  OrderStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

jest.mock('@/components/account/orders/create-return-dialog', () => ({
  CreateReturnDialog: () => null,
}));

jest.mock('@/components/account/orders/tracking-dialog', () => ({
  TrackingDialog: () => null,
}));

jest.mock('@/lib/client/returns', () => ({
  fetchReturnsForOrder: jest.fn(),
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
  items: [],
  currency: 'EUR',
  price: {
    subtotal: {
      net: 100,
      gross: 119,
      tax: 19,
      currency: 'EUR',
    },
    total: {
      net: 100,
      gross: 119,
      tax: 19,
      currency: 'EUR',
    },
  },
};

describe('Order cross-links', () => {
  beforeEach(() => {
    useOrderMock.mockReset();
    useOrderMock.mockReturnValue({
      order: baseOrder,
      loading: false,
      error: null,
      cancelOrder: undefined,
      statusTransitions: [],
    });
  });

  it('renders the related quote link on order list and detail views when quoteId is present', () => {
    const linkedOrder = { ...baseOrder, quoteId: 'Q-1000' };
    useOrderMock.mockReturnValue({
      order: linkedOrder,
      loading: false,
      error: null,
      cancelOrder: undefined,
      statusTransitions: [],
    });

    render(
      <>
        <OrdersTable orders={[linkedOrder]} />
        <OrderDetail orderId={linkedOrder.id} initialOrder={linkedOrder} />
      </>,
    );

    expect(screen.getAllByText('relatedQuote')[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '#Q-1000' })[0]).toHaveAttribute('href', '/account/quotes/Q-1000');
  });

  it('omits related quote UI when quoteId is absent', () => {
    render(
      <>
        <OrdersTable orders={[baseOrder]} />
        <OrderDetail orderId={baseOrder.id} initialOrder={baseOrder} />
      </>,
    );

    expect(screen.queryByText('relatedQuote')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '#Q-1000' })).not.toBeInTheDocument();
  });
});
