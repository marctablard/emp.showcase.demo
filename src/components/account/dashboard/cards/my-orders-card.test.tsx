/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { MyOrdersCard } from './my-orders-card';

const mockUseOrders = jest.fn();
const mockSetPageNumber = jest.fn();
const mockRefetchOrders = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/common/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}));

jest.mock('@/hooks/order/useOrders', () => ({
  useOrders: (options: unknown) => mockUseOrders(options),
}));

jest.mock('@/components/account/orders/my-orders-table', () => ({
  MyOrdersTable: ({
    onSortChange,
    hasActiveSearch,
  }: {
    onSortChange: (field: 'status', direction: 'asc') => void;
    hasActiveSearch?: boolean;
  }) => (
    <>
      <table>
        <thead>
          <tr>
            <th scope="col">status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <button type="button" onClick={() => onSortChange('status', 'asc')}>
                trigger-sort
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div data-testid="search-state">{hasActiveSearch ? 'search-on' : 'search-off'}</div>
      <div data-slot="table-pagination" />
    </>
  ),
}));

function buildOrder(id: string): Order {
  return {
    id,
    status: 'CONFIRMED',
    createdAt: '2026-01-01T10:00:00.000Z',
    items: [],
  } as Order;
}

describe('MyOrdersCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetPageNumber.mockReset();
    mockRefetchOrders.mockReset();
    mockUseOrders.mockReset();
    mockUseOrders.mockImplementation(() => ({
      orders: [buildOrder('order-1')],
      loading: false,
      error: null,
      totalCount: 14,
      pageNumber: 2,
      setPageNumber: mockSetPageNumber,
      refetchOrders: mockRefetchOrders,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('wraps the search, table, and pagination in exactly one shared table-card surface in pageMode', () => {
    const { container } = render(
      <MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />,
    );

    const tableCards = container.querySelectorAll('[data-slot="table-card"]');
    expect(tableCards).toHaveLength(1);

    const tableCard = tableCards[0];
    expect(tableCard.querySelector('input')).not.toBeNull();
    expect(tableCard.querySelector('table')).not.toBeNull();
    expect(tableCard.querySelector('[data-slot="table-pagination"]')).not.toBeNull();
  });

  it('requests orders with server-page, query and sort state plus the canonical initial request seed', () => {
    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    const firstCall = mockUseOrders.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall).toMatchObject({
      pageSize: 5,
      pageNumber: 1,
      sort: 'created:DESC',
      query: undefined,
      initialTotalCount: 14,
    });

    expect(firstCall.initialRequest).toEqual({
      pageNumber: 1,
      pageSize: 5,
      sort: 'created:DESC',
      query: undefined,
    });
  });

  it('updates request params when query or sort changes, and resets to page 1 on sort change', () => {
    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'search.placeholder' }), {
      target: { value: 'ORD-10' },
    });

    // The stale-page race for the debounced search is corrected synchronously
    // inside useOrders itself (see useOrders.test.tsx); MyOrdersCard only needs
    // to forward the settled query/sort, so it does not call setPageNumber here.
    const queryCall = mockUseOrders.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(queryCall.query).toBe('id:~(ORD-10)');
    expect(queryCall.sort).toBe('created:DESC');

    fireEvent.click(screen.getByRole('button', { name: 'trigger-sort' }));

    expect(mockSetPageNumber).toHaveBeenCalledWith(1);

    const sortCall = mockUseOrders.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(sortCall.sort).toBe('status:ASC');
  });

  it('passes hasActiveSearch to table so search-empty state is rendered in one place', () => {
    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    expect(screen.getByTestId('search-state')).toHaveTextContent('search-off');

    fireEvent.change(screen.getByRole('textbox', { name: 'search.placeholder' }), {
      target: { value: 'Ada' },
    });

    expect(screen.getByTestId('search-state')).toHaveTextContent('search-on');
  });

  it('clears quick search back to an undefined API query after debounce', () => {
    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    const input = screen.getByRole('textbox', { name: 'search.placeholder' });
    fireEvent.change(input, { target: { value: 'Ada' } });
    fireEvent.change(input, { target: { value: '' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const latestCall = mockUseOrders.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(latestCall.query).toBeUndefined();
  });

  it('renders an error banner with a retry action instead of the table when the order fetch fails, and retries on click', () => {
    mockUseOrders.mockImplementation(() => ({
      orders: undefined,
      loading: false,
      error: new Error('boom'),
      totalCount: undefined,
      pageNumber: 1,
      setPageNumber: mockSetPageNumber,
      refetchOrders: mockRefetchOrders,
    }));

    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    expect(screen.getByText('errorLoadingOrders: boom')).toBeInTheDocument();
    expect(screen.queryByText('trigger-sort')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'tryAgain' }));

    expect(mockRefetchOrders).toHaveBeenCalledTimes(1);
  });
});
