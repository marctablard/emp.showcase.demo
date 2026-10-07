/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { MyOrdersTable } from './my-orders-table';

const push = jest.fn();
const translatedStatuses: Record<string, string> = {
  'status.created': 'Zulu',
  'status.delivered': 'Alpha',
};

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({ addItem: jest.fn(), loading: false }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => translatedStatuses[key] ?? key,
  useLocale: () => 'en-US',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/client/returns', () => ({
  fetchReturnsForOrderIds: jest.fn().mockResolvedValue([]),
}));

function buildOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    status: 'CONFIRMED',
    createdAt: '2026-01-01T10:00:00.000Z',
    items: [],
    shippingAddress: {
      street: 'Main St',
      streetNumber: '1',
      zipCode: '12345',
      city: 'Berlin',
      country: 'DE',
    } as Order['shippingAddress'],
    price: {
      subtotal: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
      total: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
    },
    shipping: { total: { value: 5, currency: 'EUR' } },
    customer: { id: 'customer-1', name: 'Jane Doe' },
    ...overrides,
  } as Order;
}

async function renderTable(overrides: Partial<ComponentProps<typeof MyOrdersTable>> = {}) {
  const onSortChange = jest.fn();
  const props: ComponentProps<typeof MyOrdersTable> = {
    orders: [buildOrder({})],
    currentPage: 1,
    ordersPerPage: 5,
    totalCount: 1,
    sortField: 'orderDate',
    sortDirection: 'desc',
    onPreviousPage: jest.fn(),
    onNextPage: jest.fn(),
    onSortChange,
    ...overrides,
  };

  const view = render(<MyOrdersTable {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return {
    ...view,
    props,
    onSortChange,
  };
}

describe('MyOrdersTable', () => {
  it('renders the table with semantic table structure', async () => {
    await renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders the canonical column sequence with status just before the action column', async () => {
    await renderTable();

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'columns.orderNumber',
      'columns.customer',
      'columns.orderDate',
      'columns.channel',
      'columns.orderValue',
      'columns.totalShippingCost',
      'columns.payment',
      'columns.products',
      'columns.status',
      'columns.action',
    ]);
  });

  it('displays the net order value rather than gross', async () => {
    await renderTable({
      orders: [
        buildOrder({
          price: {
            subtotal: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
            total: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
          },
        }),
      ],
    });

    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.queryByText(/100/)).not.toBeInTheDocument();
  });

  it('links the primary order id, the row, and the view action to the same order destination', async () => {
    await renderTable({ orders: [buildOrder({ id: 'order-42' })] });

    const row = screen.getByTestId('orders-row-order-42');
    expect(screen.getByRole('link', { name: '#order-42' })).toHaveAttribute('href', '/account/orders/order-42');

    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith('/account/orders/order-42');

    push.mockClear();
    fireEvent.click(within(row).getByRole('button', { name: 'columns.view' }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/account/orders/order-42');
  });

  it('keeps the Action column non-sortable with no "View" text', async () => {
    await renderTable();

    const actionHeader = screen.getByRole('columnheader', { name: 'columns.action' });
    expect(actionHeader).not.toHaveAttribute('aria-sort');
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(within(actionHeader).queryByText('columns.view')).not.toBeInTheDocument();
  });

  it('requests server-side sort changes only from sortable headers', async () => {
    const { onSortChange } = await renderTable({
      sortField: 'customer',
      sortDirection: 'desc',
      orders: [buildOrder({ id: 'order-a', quoteId: 'Q100' })],
    });

    const channelHeader = screen.getByRole('columnheader', { name: 'columns.channel' });
    expect(channelHeader).not.toHaveAttribute('aria-sort');
    expect(within(channelHeader).queryByRole('button')).not.toBeInTheDocument();

    const header = screen.getByRole('columnheader', { name: /columns\.customer/ });
    expect(header).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(header).getByRole('button'));
    expect(onSortChange).toHaveBeenCalledWith('customer', 'asc');
  });

  it('keeps server order as provided (no local client-side row reordering)', async () => {
    await renderTable({
      sortField: 'orderDate',
      sortDirection: 'asc',
      orders: [
        buildOrder({ id: 'order-new', createdAt: '2026-02-01T10:00:00.000Z' }),
        buildOrder({ id: 'order-old', createdAt: '2026-01-01T10:00:00.000Z' }),
      ],
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('#order-new')).toBeInTheDocument();
    expect(within(rows[1]).getByText('#order-old')).toBeInTheDocument();
  });

  it('does not locally slice the server page payload by current page/ordersPerPage', async () => {
    await renderTable({
      ordersPerPage: 1,
      currentPage: 2,
      totalCount: 6,
      orders: [buildOrder({ id: 'order-a' }), buildOrder({ id: 'order-b' })],
    });

    expect(screen.getByText('#order-a')).toBeInTheDocument();
    expect(screen.getByText('#order-b')).toBeInTheDocument();
  });

  it('uses server totalCount for pagination boundaries, not the visible row count', async () => {
    const onPreviousPage = jest.fn();
    const onNextPage = jest.fn();

    const { rerender } = render(
      <MyOrdersTable
        orders={[buildOrder({ id: 'order-0' })]}
        currentPage={1}
        ordersPerPage={5}
        totalCount={12}
        sortField="orderDate"
        sortDirection="desc"
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onSortChange={jest.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('previous')).not.toBeInTheDocument();
    const nextButton = screen.getByText('next');
    fireEvent.click(nextButton);
    expect(onNextPage).toHaveBeenCalledTimes(1);

    rerender(
      <MyOrdersTable
        orders={[buildOrder({ id: 'order-10' })]}
        currentPage={3}
        ordersPerPage={5}
        totalCount={12}
        sortField="orderDate"
        sortDirection="desc"
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onSortChange={jest.fn()}
      />,
    );

    const previousButton = screen.getByText('previous');
    fireEvent.click(previousButton);
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('next')).not.toBeInTheDocument();
  });

  it('reflects the active sort state through aria-sort', async () => {
    await renderTable({ sortField: 'status', sortDirection: 'asc' });

    const statusHeader = screen.getByRole('columnheader', { name: 'columns.status' });
    const orderDateHeader = screen.getByRole('columnheader', { name: /columns\.orderDate/ });

    expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(orderDateHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('does not navigate the row when the related quote link is clicked', async () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'quote-9' });

    await renderTable({ orders: [order] });

    const quoteLink = await screen.findByRole('link', { name: '#quote-9' });
    fireEvent.click(quoteLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the related quote link below the order number', async () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'Q1000375' });

    await renderTable({ orders: [order] });

    const row = screen.getByTestId('orders-row-order-return');
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(10);

    const quoteLink = within(cells[0]).getByRole('link', { name: '#Q1000375' });
    expect(quoteLink).toHaveAttribute('href', '/account/quotes/Q1000375');
    expect(cells[0]).toHaveTextContent('relatedQuote');
  });

  it('omits the related quote link when an order has no related quote', async () => {
    const order = buildOrder({ id: 'order-no-quote' });
    delete (order as { quoteId?: string }).quoteId;

    await renderTable({ orders: [order] });

    const row = screen.getByTestId('orders-row-order-no-quote');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).not.toHaveTextContent('relatedQuote');
    expect(within(cells[0]).getAllByRole('link')).toHaveLength(1);
  });

  it('does not flash the empty state while reloading and no rows have loaded yet', async () => {
    const { rerender } = await renderTable({ orders: [], loading: true, totalCount: 0 });
    expect(screen.queryByText('noOrders')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1); // header row only

    rerender(
      <MyOrdersTable
        orders={[]}
        currentPage={1}
        ordersPerPage={5}
        totalCount={0}
        sortField="orderDate"
        sortDirection="desc"
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
        onSortChange={jest.fn()}
      />,
    );
    expect(screen.getByText('noOrders')).toBeInTheDocument();
  });

  it('keeps rows mounted and dimmed while reloading, showing a spinner only on the active sort column', async () => {
    await renderTable({
      orders: [buildOrder({ id: 'order-42' })],
      loading: true,
      sortField: 'orderDate',
      sortDirection: 'desc',
    });

    expect(screen.getByText('#order-42')).toBeInTheDocument();
    expect(screen.queryByText('noOrders')).not.toBeInTheDocument();

    const orderDateHeader = screen.getByRole('columnheader', { name: /columns\.orderDate/ });
    expect(within(orderDateHeader).getByRole('status')).toBeInTheDocument();

    const statusHeader = screen.getByRole('columnheader', { name: 'columns.status' });
    expect(within(statusHeader).queryByRole('status')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table.closest('[data-slot="table-container"]')?.parentElement).toHaveClass('opacity-70');
  });

  it('shows only one search-specific empty-state message when active search returns no rows', async () => {
    await renderTable({ orders: [], loading: false, totalCount: 0, hasActiveSearch: true });

    expect(screen.getByText('noMatches')).toBeInTheDocument();
    expect(screen.queryByText('noOrders')).not.toBeInTheDocument();
  });
});
