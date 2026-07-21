/**
 * @jest-environment jsdom
 */
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
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
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

describe('MyOrdersTable', () => {
  it('renders the canonical column sequence without a Payment column', () => {
    render(
      <MyOrdersTable
        orders={[buildOrder({})]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'columns.orderNumber',
      'relatedQuote #',
      'columns.orderDate',
      'columns.status',
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

  it('renders the Related Quote # heading as the exact second column', () => {
    render(
      <MyOrdersTable
        orders={[buildOrder({})]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers[1]).toHaveTextContent('relatedQuote #');
  });

  it('displays the net order value rather than gross', () => {
    render(
      <MyOrdersTable
        orders={[
          buildOrder({
            price: {
              subtotal: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
              total: { net: 90, gross: 100, tax: 10, currency: 'EUR' },
            },
          }),
        ]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.queryByText(/100/)).not.toBeInTheDocument();
  });

  it('links the primary order id and the row/arrow to the same order destination', () => {
    render(
      <MyOrdersTable
        orders={[buildOrder({ id: 'order-42' })]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const row = screen.getByText('#order-42').closest('tr');
    expect(row).not.toBeNull();

    expect(screen.getByRole('link', { name: '#order-42' })).toHaveAttribute('href', '/account/orders/order-42');
    const arrowLink = within(row as HTMLTableRowElement).getAllByRole('link')[1];
    expect(arrowLink).toHaveAttribute('href', '/account/orders/order-42');

    fireEvent.click(row as HTMLTableRowElement);
    expect(push).toHaveBeenCalledWith('/account/orders/order-42');
  });

  it('keeps the Action column non-sortable with no "View" text', () => {
    render(
      <MyOrdersTable
        orders={[buildOrder({})]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const actionHeader = screen.getByRole('columnheader', { name: 'columns.action' });
    expect(actionHeader).not.toHaveAttribute('aria-sort');
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('columns.view')).not.toBeInTheDocument();
  });

  it('adds an accessible sort control to the Expected Delivery Date column without changing its placeholder-only display', () => {
    const orders = [buildOrder({ id: 'order-a' }), buildOrder({ id: 'order-b' })];

    render(
      <MyOrdersTable
        orders={orders}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'columns.expectedDeliveryDate' });
    expect(header).toHaveAttribute('aria-sort', 'none');

    const button = within(header).getByRole('button');
    fireEvent.click(button);
    expect(header).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(button);
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    const cells = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[7]);
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell).toHaveTextContent('-');
    }
  });

  it('sorts by the Related Quote # column using the quote id and toggles aria-sort', () => {
    const orders = [buildOrder({ id: 'order-a', quoteId: 'Q100' }), buildOrder({ id: 'order-b', quoteId: 'Q200' })];

    render(
      <MyOrdersTable
        orders={orders}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const header = screen.getByRole('columnheader', { name: /relatedQuote #/ });
    expect(header).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('#order-b')).toBeInTheDocument();

    fireEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('#order-a')).toBeInTheDocument();
  });

  it('sorts by localized Status labels instead of enum names and keeps aria-sort in sync', () => {
    const orders = [
      buildOrder({ id: 'order-created', status: 'CREATED' }),
      buildOrder({ id: 'order-delivered', status: 'DELIVERED' }),
    ];

    render(
      <MyOrdersTable
        orders={orders}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const statusHeader = screen.getByRole('columnheader', { name: 'columns.status' });
    expect(statusHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(statusHeader).getByRole('button'));
    expect(statusHeader).toHaveAttribute('aria-sort', 'descending');

    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('#order-created')).toBeInTheDocument();

    fireEvent.click(within(statusHeader).getByRole('button'));
    expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');

    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('#order-delivered')).toBeInTheDocument();
  });

  it('toggles sort direction, reorders rows, and notifies the parent via onSortChange', () => {
    const onSortChange = jest.fn();
    const orders = [
      buildOrder({ id: 'order-a', createdAt: '2026-01-01T10:00:00.000Z' }),
      buildOrder({ id: 'order-b', createdAt: '2026-02-01T10:00:00.000Z' }),
    ];

    render(
      <MyOrdersTable
        orders={orders}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
        onSortChange={onSortChange}
      />,
    );

    const orderDateHeader = screen.getByRole('columnheader', { name: /columns\.orderDate/ });
    // Default sort is orderDate desc: order-b (Feb) should come before order-a (Jan).
    const rowsBefore = screen.getAllByRole('row').slice(1);
    expect(within(rowsBefore[0]).getByText('#order-b')).toBeInTheDocument();
    expect(orderDateHeader).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(orderDateHeader).getByRole('button'));

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(orderDateHeader).toHaveAttribute('aria-sort', 'ascending');
    const rowsAfter = screen.getAllByRole('row').slice(1);
    expect(within(rowsAfter[0]).getByText('#order-a')).toBeInTheDocument();
  });

  it('does not navigate the row when the related quote link is clicked', async () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'quote-9' });

    render(
      <MyOrdersTable
        orders={[order]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const quoteLink = await screen.findByRole('link', { name: '#quote-9' });
    fireEvent.click(quoteLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the related quote link in the second column and keeps the Order # cell link-only', () => {
    const order = buildOrder({ id: 'order-return', status: 'COMPLETED', quoteId: 'Q1000375' });

    render(
      <MyOrdersTable
        orders={[order]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const row = screen.getByText('#order-return').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(10);

    const orderNumberCell = cells[0];
    expect(within(orderNumberCell).queryByRole('link', { name: '#Q1000375' })).not.toBeInTheDocument();
    expect(orderNumberCell).not.toHaveTextContent('relatedQuote');

    const quoteCell = cells[1];
    const quoteLink = within(quoteCell).getByRole('link', { name: '#Q1000375' });
    expect(quoteLink).toHaveAttribute('href', '/account/quotes/Q1000375');
  });

  it('shows a placeholder in the Related Quote # column when an order has no related quote', () => {
    const order = buildOrder({ id: 'order-no-quote' });
    delete (order as { quoteId?: string }).quoteId;

    render(
      <MyOrdersTable
        orders={[order]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const row = screen.getByText('#order-no-quote').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('-');
    expect(within(cells[1]).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows loading and empty states spanning all columns', () => {
    const { rerender } = render(
      <MyOrdersTable
        orders={[]}
        currentPage={1}
        ordersPerPage={5}
        loading
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();

    rerender(
      <MyOrdersTable orders={[]} currentPage={1} ordersPerPage={5} onPreviousPage={jest.fn()} onNextPage={jest.fn()} />,
    );
    expect(screen.getByText('noOrders')).toBeInTheDocument();
  });

  it('shows only the Next control on the first page and only the Previous control on the last page', () => {
    const orders = Array.from({ length: 12 }, (_, index) =>
      buildOrder({ id: `order-${index}`, createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z` }),
    );

    const { rerender } = render(
      <MyOrdersTable
        orders={orders}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    expect(screen.queryByText('previous')).not.toBeInTheDocument();
    expect(screen.getByText('next')).toBeInTheDocument();

    rerender(
      <MyOrdersTable
        orders={orders}
        currentPage={3}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    expect(screen.getByText('previous')).toBeInTheDocument();
    expect(screen.queryByText('next')).not.toBeInTheDocument();
  });

  it('gives the horizontal scroll container trailing padding so the last Action column is never clipped at max scroll', () => {
    render(
      <MyOrdersTable
        orders={[buildOrder({})]}
        currentPage={1}
        ordersPerPage={5}
        onPreviousPage={jest.fn()}
        onNextPage={jest.fn()}
      />,
    );

    const table = screen.getByRole('table');
    const scrollContainer = table.parentElement as HTMLElement;
    expect(scrollContainer).toHaveClass('overflow-x-auto', 'pr-1');
  });
});
