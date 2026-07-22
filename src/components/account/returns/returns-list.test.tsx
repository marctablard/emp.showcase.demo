/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Return } from '@/platform/services/model/return';
import { ReturnsList } from './returns-list';

const push = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values && 'id' in values) {
      return `${key}:${values.id}`;
    }

    return key;
  },
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

jest.mock('@/hooks/return/useReturns', () => ({
  useReturns: (...args: unknown[]) => mockUseReturns(...args),
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
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders columns in the contract order: Return Number, Return Date, Status, Order Number, Customer, Net Return Value, Reason, Action', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'returnNumber',
      'returnDate',
      'statusLabel',
      'orderNumber',
      'customer',
      'netReturnValue',
      'reasonLabel',
      'action',
    ]);
  });

  it('wraps the search, table, and pagination in the shared table-card surface', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 12 });
    const { container } = render(<ReturnsList initialReturns={[buildReturn()]} initialTotalCount={12} />);

    const tableCard = container.querySelector('[data-slot="table-card"]');
    expect(tableCard).not.toBeNull();
    expect(tableCard).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(tableCard).not.toHaveClass('shadow-sm');
    expect(tableCard?.querySelector('table')).not.toBeNull();
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

  it('keeps Return Number, Order Number, Customer, and Reason non-sortable', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    for (const name of ['returnNumber', 'orderNumber', 'customer', 'reasonLabel']) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
      expect(header).not.toHaveAttribute('aria-sort');
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

  it('switches sort to Status and requests the mapped approvalStatus upstream field', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const statusHeader = screen.getByRole('columnheader', { name: /statusLabel/ });
    fireEvent.click(within(statusHeader).getByRole('button'));

    expect(statusHeader).toHaveAttribute('aria-sort', 'descending');
    const lastCallOptions = mockUseReturns.mock.calls[mockUseReturns.mock.calls.length - 1][1];
    expect(lastCallOptions).toMatchObject({ sort: 'approvalStatus:DESC', pageNumber: 1 });
  });

  it('keeps Net Return Value non-sortable because no exact upstream sort field matches displayed net value', () => {
    mockReturnsResult({ returns: [buildReturn()], totalCount: 1 });
    render(<ReturnsList initialReturns={[buildReturn()]} />);

    const valueHeader = screen.getByRole('columnheader', { name: /netReturnValue/ });
    expect(within(valueHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(valueHeader).not.toHaveAttribute('aria-sort');
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
      'cursor-pointer',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
      'text-text-action',
      'font-bold',
    );
    expect(returnNumberLink).not.toHaveClass('underline');

    const arrowLink = screen.getByRole('link', { name: 'viewReturnAriaLabel:ret-42' });
    expect(arrowLink).toHaveClass('no-underline', 'cursor-pointer', 'font-secondary', 'text-[16px]', 'leading-[24px]');
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
    expect(orderLink).toHaveClass('no-underline', 'cursor-pointer', 'font-secondary', 'text-[16px]', 'leading-[24px]');
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

  it('displays only calculatedPrice.finalPrice.netValue for Net Return Value, never falling back to total', () => {
    const returnItem = buildReturn({
      id: 'ret-no-net',
      calculatedPrice: undefined,
      total: { value: 999, currency: 'USD' },
    });
    mockReturnsResult({ returns: [returnItem], totalCount: 1 });
    render(<ReturnsList initialReturns={[returnItem]} />);

    const row = screen.getByText('ret-no-net').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(8);
    expect(cells[5]).toHaveTextContent('-');
  });

  it('derives Customer from requestor fullName, composed name, then email, defaulting to "-"', () => {
    const withFullName = buildReturn({ id: 'r-full', requestor: { fullName: 'Full Name' } });
    const withComposedName = buildReturn({ id: 'r-composed', requestor: { firstName: 'First', lastName: 'Last' } });
    const withEmailOnly = buildReturn({ id: 'r-email', requestor: { email: 'only@example.com' } });
    const withNoRequestor = buildReturn({ id: 'r-none', requestor: undefined });
    const returns = [withFullName, withComposedName, withEmailOnly, withNoRequestor];
    mockReturnsResult({ returns, totalCount: returns.length });
    render(<ReturnsList initialReturns={returns} />);

    expect(
      within(screen.getByText('r-full').closest('tr') as HTMLTableRowElement).getByText('Full Name'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('r-composed').closest('tr') as HTMLTableRowElement).getByText('First Last'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('r-email').closest('tr') as HTMLTableRowElement).getByText('only@example.com'),
    ).toBeInTheDocument();
    const noRequestorRow = screen.getByText('r-none').closest('tr') as HTMLTableRowElement;
    const cells = within(noRequestorRow).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('-');
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
    expect(cells[6]).toHaveTextContent('-');
  });

  it('shows the loading state, then the empty state, when there are no returns', () => {
    mockReturnsResult({ returns: [], totalCount: 0, loading: true });
    const { rerender } = render(<ReturnsList initialReturns={[]} />);
    expect(screen.getAllByText('loading').length).toBeGreaterThan(0);

    mockReturnsResult({ returns: [], totalCount: 0, loading: false });
    rerender(<ReturnsList initialReturns={[]} />);
    expect(screen.getByText('noReturns')).toBeInTheDocument();
  });

  it('shows an error state and retries via refreshReturns', () => {
    const refreshReturns = jest.fn();
    mockReturnsResult({ returns: [], totalCount: 0, error: new Error('boom'), refreshReturns });
    render(<ReturnsList initialReturns={[]} />);

    expect(screen.getByText(/errorLoading/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('tryAgain'));
    expect(refreshReturns).toHaveBeenCalledTimes(1);
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
