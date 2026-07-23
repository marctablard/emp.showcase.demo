/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { MyOrdersTable } from './my-orders-table';

const push = jest.fn();
const translatedStatuses: Record<string, string> = {
  'status.created': 'Zulu',
  'status.delivered': 'Alpha',
};

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

function renderTable(overrides: Partial<ComponentProps<typeof MyOrdersTable>> = {}) {
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

  return {
    ...render(<MyOrdersTable {...props} />),
    props,
    onSortChange,
  };
}

describe('MyOrdersTable', () => {
  it('renders the canonical column sequence without a Payment column', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'columns.orderNumber',
      'columns.orderDate',
      'columns.status',
      'relatedQuote #',
      'columns.orderValue',
      'columns.totalShippingCost',
      'columns.customer',
      'columns.expectedDeliveryDate',
      'columns.deliveryAddress',
      'columns.action',
    ]);
    expect(headers).toHaveLength(10);
    expect(screen.queryByText('columns.payment')).not.toBeInTheDocument();
  });

  it('renders the Related Quote heading as the exact fourth column', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader');
    expect(headers[3]).toHaveTextContent('relatedQuote #');
  });

  it('displays the net order value rather than gross', () => {
    renderTable({
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

  it('links the primary order id and the row/arrow to the same order destination', () => {
    renderTable({ orders: [buildOrder({ id: 'order-42' })] });

    const row = screen.getByText('order-42').closest('tr');
    expect(row).not.toBeNull();

    expect(screen.getByRole('link', { name: 'order-42' })).toHaveAttribute('href', '/account/orders/order-42');
    const arrowLink = within(row as HTMLTableRowElement).getAllByRole('link')[1];
    expect(arrowLink).toHaveAttribute('href', '/account/orders/order-42');

    fireEvent.click(row as HTMLTableRowElement);
    expect(push).toHaveBeenCalledWith('/account/orders/order-42');
  });

  it('uses shared table-link styling (no underline, default cursor, and table typography) for table links', () => {
    renderTable({ orders: [buildOrder({ id: 'order-42', quoteId: 'quote-9' })] });

    const idLink = screen.getByRole('link', { name: 'order-42' });
    expect(idLink).toHaveClass(
      'no-underline',
      'cursor-default',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
      'text-text-action',
      'font-bold',
    );
    expect(idLink).not.toHaveClass('underline');

    const quoteLink = screen.getByRole('link', { name: 'quote-9' });
    expect(quoteLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
    expect(quoteLink).not.toHaveClass('underline');

    const row = screen.getByText('order-42').closest('tr') as HTMLTableRowElement;
    const arrowLink = within(row).getAllByRole('link')[2];
    expect(arrowLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
  });

  it('keeps the Action column non-sortable with no "View" text', () => {
    renderTable();

    const actionHeader = screen.getByRole('columnheader', { name: 'columns.action' });
    expect(actionHeader).not.toHaveAttribute('aria-sort');
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('columns.view')).not.toBeInTheDocument();
  });

  it('renders expected delivery date using date formatting and falls back to a dash when absent', () => {
    renderTable({
      orders: [
        buildOrder({ id: 'order-a', expectedDeliveryDate: '2026-08-01' }),
        buildOrder({ id: 'order-b', expectedDeliveryDate: undefined }),
      ],
    });

    const rows = screen.getAllByRole('row').slice(1);
    const firstDeliveryCell = within(rows[0]).getAllByRole('cell')[7];
    const secondDeliveryCell = within(rows[1]).getAllByRole('cell')[7];

    expect(firstDeliveryCell).toHaveTextContent('08/01/2026');
    expect(secondDeliveryCell).toHaveTextContent('-');
  });

  it('requests server-side sort changes only from sortable headers', () => {
    const { onSortChange } = renderTable({
      sortField: 'relatedQuote',
      sortDirection: 'desc',
      orders: [buildOrder({ id: 'order-a', quoteId: 'Q100' })],
    });

    const expectedDeliveryHeader = screen.getByRole('columnheader', { name: 'columns.expectedDeliveryDate' });
    expect(expectedDeliveryHeader).not.toHaveAttribute('aria-sort');
    expect(within(expectedDeliveryHeader).queryByRole('button')).not.toBeInTheDocument();

    const header = screen.getByRole('columnheader', { name: /relatedQuote/ });
    expect(header).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(header).getByRole('button'));
    expect(onSortChange).toHaveBeenCalledWith('relatedQuote', 'asc');
  });

  it('keeps server order as provided (no local client-side row reordering)', () => {
    renderTable({
      sortField: 'orderDate',
      sortDirection: 'asc',
      orders: [
        buildOrder({ id: 'order-new', createdAt: '2026-02-01T10:00:00.000Z' }),
        buildOrder({ id: 'order-old', createdAt: '2026-01-01T10:00:00.000Z' }),
      ],
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('order-new')).toBeInTheDocument();
    expect(within(rows[1]).getByText('order-old')).toBeInTheDocument();
  });

  it('does not locally slice the server page payload by current page/ordersPerPage', () => {
    renderTable({
      ordersPerPage: 1,
      currentPage: 2,
      totalCount: 6,
      orders: [buildOrder({ id: 'order-a' }), buildOrder({ id: 'order-b' })],
    });

    expect(screen.getByText('order-a')).toBeInTheDocument();
    expect(screen.getByText('order-b')).toBeInTheDocument();
  });

  it('uses server totalCount for pagination boundaries, not the visible row count', () => {
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

  it('reflects the active sort state through aria-sort', () => {
    renderTable({ sortField: 'status', sortDirection: 'asc' });

    const statusHeader = screen.getByRole('columnheader', { name: 'columns.status' });
    const orderDateHeader = screen.getByRole('columnheader', { name: /columns\.orderDate/ });

    expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(orderDateHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('does not navigate the row when the related quote link is clicked', async () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'quote-9' });

    renderTable({ orders: [order] });

    const quoteLink = await screen.findByRole('link', { name: 'quote-9' });
    fireEvent.click(quoteLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the related quote link in the fourth column and keeps the Order Number cell link-only', () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'Q1000375' });

    renderTable({ orders: [order] });

    const row = screen.getByText('order-return').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(10);

    const orderNumberCell = cells[0];
    expect(within(orderNumberCell).queryByRole('link', { name: 'Q1000375' })).not.toBeInTheDocument();
    expect(orderNumberCell).not.toHaveTextContent('relatedQuote');

    const quoteCell = cells[3];
    const quoteLink = within(quoteCell).getByRole('link', { name: 'Q1000375' });
    expect(quoteLink).toHaveAttribute('href', '/account/quotes/Q1000375');
  });

  it('shows a placeholder in the Related Quote column when an order has no related quote', () => {
    const order = buildOrder({ id: 'order-no-quote' });
    delete (order as { quoteId?: string }).quoteId;

    renderTable({ orders: [order] });

    const row = screen.getByText('order-no-quote').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('-');
    expect(within(cells[3]).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows loading and empty states spanning all columns', () => {
    const { rerender } = renderTable({ orders: [], loading: true, totalCount: 0 });
    expect(screen.getByText('loading')).toBeInTheDocument();

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

  it('shows only one search-specific empty-state message when active search returns no rows', () => {
    renderTable({ orders: [], loading: false, totalCount: 0, hasActiveSearch: true });

    expect(screen.getByText('noMatches')).toBeInTheDocument();
    expect(screen.queryByText('noOrders')).not.toBeInTheDocument();
  });

  it('gives the horizontal scroll container trailing padding so the last Action column is never clipped at max scroll', () => {
    renderTable();

    const table = screen.getByRole('table');
    const scrollContainer = table.parentElement as HTMLElement;
    expect(scrollContainer).toHaveClass('overflow-x-auto', 'pr-1');
  });
});
