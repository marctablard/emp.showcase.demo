/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Order } from '@/platform/services/model/order/order';
import { MyOrdersCard } from './my-orders-card';

const mockUseOrders = jest.fn();
const mockSetPageNumber = jest.fn();

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
  MyOrdersTable: ({ onSortChange }: { onSortChange: (field: 'status', direction: 'asc') => void }) => (
    <button type="button" onClick={() => onSortChange('status', 'asc')}>
      trigger-sort
    </button>
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
    mockSetPageNumber.mockReset();
    mockUseOrders.mockReset();
    mockUseOrders.mockImplementation(() => ({
      orders: [buildOrder('order-1')],
      loading: false,
      totalCount: 14,
      pageNumber: 2,
      setPageNumber: mockSetPageNumber,
    }));
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

  it('resets to page 1 when query or sort changes and updates request params', () => {
    render(<MyOrdersCard pageMode initialOrders={[buildOrder('initial-1')]} initialTotalCount={14} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'search.placeholder' }), {
      target: { value: 'ORD-10' },
    });

    expect(mockSetPageNumber).toHaveBeenCalledWith(1);

    const queryCall = mockUseOrders.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(queryCall.query).toBe('id:~(ORD-10)');
    expect(queryCall.sort).toBe('created:DESC');

    fireEvent.click(screen.getByRole('button', { name: 'trigger-sort' }));

    expect(mockSetPageNumber).toHaveBeenCalledWith(1);

    const sortCall = mockUseOrders.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(sortCall.sort).toBe('status:ASC');
  });
});
