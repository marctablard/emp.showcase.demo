/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReturnApiError } from '@/lib/client/returns';
import type { Return } from '@/platform/services/model/return';
import { ReturnsList } from './returns-list';

const push = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, string | number>) => {
        if (values && 'id' in values) {
          return `${key}:${values.id}`;
        }

        return key;
      },
      { has: () => true },
    ),
  useLocale: () => 'en-US',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

const mockUseReturns = jest.fn();
const mockTablePagination = jest.fn();

jest.mock('@/hooks/return/useReturns', () => ({
  useReturns: (...args: unknown[]) => mockUseReturns(...args),
}));

jest.mock('@/components/ui/table-pagination', () => ({
  TablePagination: ({ currentPage, totalPages, onPreviousPage, onNextPage }: any) => (
    <div>
      {currentPage > 1 ? <button onClick={onPreviousPage}>previous</button> : null}
      {currentPage < totalPages ? <button onClick={onNextPage}>next</button> : null}
    </div>
  ),
}));

function buildReturn(overrides: Partial<Return> = {}): Return {
  return {
    id: 'ret-1',
    status: 'PENDING',
    approvalStatus: 'PENDING',
    received: false,
    isExpired: false,
    orders: [{ id: 'order-1', items: [] }],
    createdAt: '2026-01-01T10:00:00.000Z',
    requestor: { fullName: 'Jane Doe', email: 'jane@example.com' },
    calculatedPrice: { finalPrice: { netValue: 42.5, grossValue: 50, taxValue: 7.5, currency: 'EUR' } },
    reason: { code: 'DEFECTIVE' },
    ...overrides,
  };
}

function mockReturnsResult(overrides: {
  returns: Return[];
  totalCount?: number;
  loading?: boolean;
  error?: Error | null;
  refreshReturns?: jest.Mock;
}) {
  mockUseReturns.mockReturnValue({
    returns: overrides.returns,
    totalCount: overrides.totalCount,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refreshReturns: overrides.refreshReturns ?? jest.fn(),
  });
}

describe('ReturnsList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders columns in the contract order: Return Number, Return Date, Status, Order Number, Net Return Value, Reason, Action', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'returnNumber',
      'returnDate',
      'statusLabel',
      'orderNumber',
      'netReturnValue',
      'reasonLabel',
      'action',
    ]);
  });

  it('wraps the search, table, and pagination in the shared table-card surface', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 12 });
    const { container } = render(<ReturnsList initialReturns={[buildReturn()]} initialTotalCount={12} />);

    const tableCards = container.querySelectorAll('[data-slot="table-card"]');
    expect(tableCards).toHaveLength(1);

    const tableCard = tableCards[0];
    expect(tableCard).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(tableCard).not.toHaveClass('shadow-sm');
    expect(tableCard.querySelector('table')).not.toBeNull();
    expect(within(tableCard as HTMLElement).getByText('next')).toBeInTheDocument();
  });

  it('passes the canonical initial page-one default-sort request metadata to useReturns for SSR hydration reuse', () => {
    const initialReturn = buildReturn();
    mockReturnsResult({ returns: [initialReturn], totalCount: 99 });

    render(<ReturnsList initialReturns={[initialReturn]} initialTotalCount={99} />);

    expect(mockUseReturns).toHaveBeenCalled();
    const [, options] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(options).toMatchObject({
      pageNumber: 1,
      pageSize: 5,
      sort: 'metadata.createdAt:DESC',
      initialTotalCount: 99,
      initialRequest: {
        pageNumber: 1,
        pageSize: 5,
        sort: 'metadata.createdAt:DESC',
        query: undefined,
      },
    });
  });

  it('resets to page one only after the debounced search changes and keeps pagination bounded by the known total', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 15 });
    render(<ReturnsList initialReturns={[buildReturn()]} initialTotalCount={15} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: '  abc  ' } });

    const [, optionsBeforeDebounce] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(optionsBeforeDebounce.pageNumber).toBe(1);
    expect(optionsBeforeDebounce.query).toBeUndefined();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, optionsAfterDebounce] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(optionsAfterDebounce.query).toBe('id:~(abc)');
    expect(optionsAfterDebounce.pageNumber).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const [, optionsAfterNext] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(optionsAfterNext.pageNumber).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    const [, optionsAfterSecondNext] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(optionsAfterSecondNext.pageNumber).toBe(3);
  });

  it('never calls useReturns with {new query, old page} when the debounced search settles after paging forward', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 25 });
    render(<ReturnsList initialReturns={[buildReturn()]} initialTotalCount={25} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    const [, pageThreeOptions] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(pageThreeOptions.pageNumber).toBe(3);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const staleCombo = mockUseReturns.mock.calls.find(
      ([, options]) => options.query === 'id:~(abc)' && options.pageNumber === 3,
    );
    expect(staleCombo).toBeUndefined();

    const [, settledOptions] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
    expect(settledOptions.query).toBe('id:~(abc)');
    expect(settledOptions.pageNumber).toBe(1);
  });

  it('keeps Order Number non-sortable', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const header = screen.getByRole('columnheader', { name: 'orderNumber' });
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    expect(header).not.toHaveAttribute('aria-sort');
  });

  it('makes Return Number, Net Return Value, and Reason sortable alongside Return Date and Status', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    for (const name of [/returnNumber/, /netReturnValue/, /reasonLabel/]) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).getByRole('button')).toBeInTheDocument();
      expect(header).toHaveAttribute('aria-sort', 'none');
    }
  });

  it('keeps the Action column non-sortable with no extra text besides the header label', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const actionHeader = screen.getByRole('columnheader', { name: 'action' });
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(actionHeader).not.toHaveAttribute('aria-sort');
  });

  it('toggles Return Date sort, requests the mapped upstream sort param, and resets to page 1', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const dateHeader = screen.getByRole('columnheader', { name: /returnDate/ });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(dateHeader).getByRole('button'));

    expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'metadata.createdAt:ASC', pageNumber: 1 });
  });

  it('shows a spinner in place of the active sort column icon while reloading, keeping the table body mounted', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1, loading: true });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const dateHeader = screen.getByRole('columnheader', { name: /returnDate/ });
    expect(within(dateHeader).getByRole('status')).toBeInTheDocument();

    const returnNumberHeader = screen.getByRole('columnheader', { name: /returnNumber/ });
    expect(within(returnNumberHeader).queryByRole('status')).not.toBeInTheDocument();

    expect(screen.getByText('ret-1')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table.closest('[data-slot="table-container"]')?.parentElement).toHaveClass('opacity-70');
  });

  it('switches sort to Status and requests the mapped approvalStatus upstream field', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const statusHeader = screen.getByRole('columnheader', { name: /statusLabel/ });
    fireEvent.click(within(statusHeader).getByRole('button'));

    expect(statusHeader).toHaveAttribute('aria-sort', 'descending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'approvalStatus:DESC', pageNumber: 1 });
  });

  it('toggles Return Number sort, requests the mapped upstream id field, and resets to page 1', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const returnNumberHeader = screen.getByRole('columnheader', { name: /returnNumber/ });
    fireEvent.click(within(returnNumberHeader).getByRole('button'));

    expect(returnNumberHeader).toHaveAttribute('aria-sort', 'descending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'id:DESC', pageNumber: 1 });
  });

  it('toggles Net Return Value sort and requests the mapped calculatedPrice.finalPrice.netValue upstream field', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const valueHeader = screen.getByRole('columnheader', { name: /netReturnValue/ });
    fireEvent.click(within(valueHeader).getByRole('button'));

    expect(valueHeader).toHaveAttribute('aria-sort', 'descending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'calculatedPrice.finalPrice.netValue:DESC', pageNumber: 1 });
  });

  it('toggles Reason sort and requests the mapped reason.code upstream field', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const reasonHeader = screen.getByRole('columnheader', { name: /reasonLabel/ });
    fireEvent.click(within(reasonHeader).getByRole('button'));

    expect(reasonHeader).toHaveAttribute('aria-sort', 'descending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'reason.code:DESC', pageNumber: 1 });
  });

  it('navigates the full row, Return Number link, and Action arrow to the same return detail destination', () => {
    const returnItem = buildReturn({ id: 'ret-42' });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const row = screen.getByText('ret-42').closest('tr') as HTMLTableRowElement;
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith('/account/returns/ret-42');

    const returnNumberLink = screen.getByRole('link', { name: 'ret-42' });
    expect(returnNumberLink).toHaveAttribute('href', '/account/returns/ret-42');

    const links = screen.getAllByRole('link');
    const arrowLink = links[links.length - 1];
    expect(arrowLink).toHaveAttribute('href', '/account/returns/ret-42');
  });

  it('uses shared table-link styling (no underline and table typography) for return links', () => {
    const returnItem = buildReturn({ id: 'ret-42' });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const returnNumberLink = screen.getByRole('link', { name: 'ret-42' });
    expect(returnNumberLink).toHaveClass(
      'no-underline',
      'cursor-default',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
      'text-text-action',
      'font-bold',
    );
    expect(returnNumberLink).not.toHaveClass('underline');

    const arrowLink = screen.getByRole('link', { name: 'viewReturnAriaLabel:ret-42' });
    expect(arrowLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
  });

  it('does not trigger row router.push when nested Return Number or Action links are clicked', () => {
    const returnItem = buildReturn({ id: 'ret-42' });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const returnNumberLink = screen.getByRole('link', { name: 'ret-42' });
    fireEvent.click(returnNumberLink);
    expect(push).not.toHaveBeenCalled();
    expect(returnNumberLink).toHaveAttribute('href', '/account/returns/ret-42');

    const arrowLink = screen.getByRole('link', { name: 'viewReturnAriaLabel:ret-42' });
    fireEvent.click(arrowLink);
    expect(push).not.toHaveBeenCalled();
    expect(arrowLink).toHaveAttribute('href', '/account/returns/ret-42');
  });

  it('supports keyboard row navigation with Enter and does not navigate on Space', () => {
    const returnItem = buildReturn({ id: 'ret-42' });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const row = screen.getByRole('row', { name: 'viewReturnAriaLabel:ret-42' });

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/account/returns/ret-42');

    push.mockClear();
    fireEvent.keyDown(row, { key: ' ' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does not row-navigate when Enter is pressed on nested links', () => {
    const returnItem = buildReturn({ id: 'ret-42', orders: [{ id: 'order-42', items: [] }] });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const returnNumberLink = screen.getByRole('link', { name: 'ret-42' });
    fireEvent.keyDown(returnNumberLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    const orderLink = screen.getByRole('link', { name: 'order-42' });
    fireEvent.keyDown(orderLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    const arrowLink = screen.getByRole('link', { name: 'viewReturnAriaLabel:ret-42' });
    fireEvent.keyDown(arrowLink, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('gives the Action arrow link a localized accessible name that identifies the return', () => {
    const returnItem = buildReturn({ id: 'ret-42' });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const arrowLink = screen.getByRole('link', { name: 'viewReturnAriaLabel:ret-42' });
    expect(arrowLink).toHaveAttribute('href', '/account/returns/ret-42');
    expect(arrowLink).toHaveTextContent('');
  });

  it('links the Order Number cell to the related order detail page using the shared table-link styling', () => {
    const returnItem = buildReturn({ id: 'ret-42', orders: [{ id: 'order-42', items: [] }] });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const orderLink = screen.getByRole('link', { name: 'order-42' });
    expect(orderLink).toHaveAttribute('href', '/account/orders/order-42');
    expect(orderLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
    expect(orderLink).not.toHaveClass('underline');
  });

  it('does not trigger row navigation when the Order Number link is clicked', () => {
    const returnItem = buildReturn({ id: 'ret-42', orders: [{ id: 'order-42', items: [] }] });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const orderLink = screen.getByRole('link', { name: 'order-42' });
    fireEvent.click(orderLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a placeholder in the Order Number column when a return has no related order', () => {
    const returnItem = buildReturn({ id: 'ret-no-order', orders: [] });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const row = screen.getByText('ret-no-order').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('-');
    expect(within(cells[3]).queryByRole('link')).not.toBeInTheDocument();
  });

  it('falls back to the customer-visible Return.total for Net Return Value when calculatedPrice is absent', () => {
    const returnItem = buildReturn({
      id: 'ret-no-net',
      calculatedPrice: undefined,
      total: { value: 999, currency: 'USD' },
    });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const row = screen.getByText('ret-no-net').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(7);
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(999);
    expect(cells[4]).toHaveTextContent(expected);
  });

  it('shows the translated reason label from the top-level reason code, or "-" when absent', () => {
    const withReason = buildReturn({ id: 'r-reason', reason: { code: 'DEFECTIVE' } });
    const withoutReason = buildReturn({ id: 'r-no-reason', reason: undefined });
    const returns = [withReason, withoutReason];
    mockReturnsResult({ returns, totalCount: returns.length });
    render(<ReturnsList initialReturns={returns} />);

    expect(
      within(screen.getByText('r-reason').closest('tr') as HTMLTableRowElement).getByText('claimReasons.DEFECTIVE'),
    ).toBeInTheDocument();
    const noReasonRow = screen.getByText('r-no-reason').closest('tr') as HTMLTableRowElement;
    const cells = within(noReasonRow).getAllByRole('cell');
    expect(cells[5]).toHaveTextContent('-');
  });

  it('sends query undefined and resets to page 1 once the search input is cleared', () => {
    jest.useFakeTimers();
    try {
      mockReturnsResult({ returns: [buildReturn()], totalCount: 12 });
      render(<ReturnsList initialReturns={[buildReturn()]} />);

      const input = screen.getByPlaceholderText('searchPlaceholder');
      fireEvent.change(input, { target: { value: 'abc' } });
      act(() => {
        jest.advanceTimersByTime(500);
      });

      fireEvent.change(input, { target: { value: '' } });

      const [, optionsAfterClearBeforeDebounce] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
      expect(optionsAfterClearBeforeDebounce.pageNumber).toBe(1);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      const [, optionsAfterDebounce] = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1];
      expect(optionsAfterDebounce.query).toBeUndefined();
      expect(optionsAfterDebounce.pageNumber).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the loading state, then the empty state, when there are no returns', () => {
    mockReturnsResult({ returns: [], totalCount: 0, loading: true });
    const { rerender } = render(<ReturnsList initialReturns={[]} />);
    expect(screen.getAllByText('loading').length).toBeGreaterThan(0);

    mockReturnsResult({ returns: [], totalCount: 0, loading: false });
    rerender(<ReturnsList initialReturns={[]} />);
    expect(screen.getByText('noReturns')).toBeInTheDocument();
  });

  it('shows a translated error and retries via refreshReturns', () => {
    const refreshReturns = jest.fn();
    mockReturnsResult({ returns: [], totalCount: 0, error: new Error('boom'), refreshReturns });
    render(<ReturnsList initialReturns={[]} />);

    expect(screen.getByText('UNEXPECTED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('tryAgain'));
    expect(refreshReturns).toHaveBeenCalledTimes(1);
  });

  it('renders the translated message for a coded failure, not the English server text', () => {
    const coded = new ReturnApiError('Failed to fetch returns', 500, { code: 'RETURNS_FETCH_FAILED' });
    mockReturnsResult({ returns: [], totalCount: 0, error: coded });
    render(<ReturnsList initialReturns={[]} />);

    expect(screen.getByText('RETURNS_FETCH_FAILED')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch returns')).not.toBeInTheDocument();
  });

  it('keeps the search field usable while an error is shown, so the offending term can be cleared', () => {
    mockReturnsResult({ returns: [], totalCount: 0, error: new Error('boom') });
    render(<ReturnsList initialReturns={[]} />);

    // The error replaces the table only; heading and search stay mounted.
    const search = screen.getByLabelText('searchPlaceholder');
    expect(search).toBeInTheDocument();
    expect(screen.getByText('UNEXPECTED')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    expect(search).toHaveValue('');
  });

  it('shows the error instead of the empty state when a load fails without a search term', () => {
    mockReturnsResult({ returns: [], totalCount: 0, error: new Error('boom') });
    render(<ReturnsList initialReturns={[]} />);

    expect(screen.getByText('UNEXPECTED')).toBeInTheDocument();
    expect(screen.queryByText('noReturns')).not.toBeInTheDocument();
  });

  it('shows only the Next control on the first page and only the Previous control on the last page', () => {
    const returns = Array.from({ length: 5 }, (_, index) => buildReturn({ id: `ret-${index}` }));
    mockReturnsResult({ returns, totalCount: 12 });
    render(<ReturnsList initialReturns={returns} />);

    expect(screen.queryByText('previous')).not.toBeInTheDocument();
    expect(screen.getByText('next')).toBeInTheDocument();

    fireEvent.click(screen.getByText('next'));
    fireEvent.click(screen.getByText('next'));

    expect(screen.getByText('previous')).toBeInTheDocument();
    expect(screen.queryByText('next')).not.toBeInTheDocument();
  });

  it('gives the horizontal scroll container trailing padding so the Action column is never clipped at max scroll', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const table = screen.getByRole('table');
    const scrollContainer = table.parentElement as HTMLElement;
    expect(scrollContainer).toHaveClass('overflow-x-auto', 'pr-1');
  });
});
