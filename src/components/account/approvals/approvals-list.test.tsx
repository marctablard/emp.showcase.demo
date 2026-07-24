/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalsList } from './approvals-list';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
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
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseApprovals = jest.fn();

jest.mock('@/hooks/approval/useApprovals', () => ({
  useApprovals: (...args: unknown[]) => mockUseApprovals(...args),
}));

jest.mock('@/components/ui/table-pagination', () => ({
  TablePagination: ({ currentPage, totalPages, onPreviousPage, onNextPage }: any) => (
    <div>
      {currentPage > 1 ? <button onClick={onPreviousPage}>previous</button> : null}
      {currentPage < totalPages ? <button onClick={onNextPage}>next</button> : null}
    </div>
  ),
}));

function buildApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'APR-1',
    resourceType: 'QUOTE',
    action: 'CHECKOUT',
    status: 'PENDING',
    resource: { id: 'quote-1' },
    requestor: { userId: 'requestor-1', firstName: 'Requester', lastName: 'One', email: 'r@example.com' },
    approver: { userId: 'approver-1', firstName: 'Approver', lastName: 'One' },
    createdAt: '2026-05-31T10:00:00.000Z',
    modifiedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function mockApprovalsResult(overrides: {
  approvals: Approval[];
  loading?: boolean;
  error?: Error | null;
  pagination?: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
}) {
  mockUseApprovals.mockReturnValue({
    approvals: overrides.approvals,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    pagination: overrides.pagination,
    refreshApprovals: jest.fn(),
  });
}

describe('ApprovalsList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('passes the canonical initial page-one default-sort request metadata to useApprovals for SSR hydration reuse', () => {
    mockApprovalsResult({
      approvals: [buildApproval()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 },
    });

    render(<ApprovalsList initialApprovals={[buildApproval()]} initialTotalCount={1} />);

    expect(mockUseApprovals).toHaveBeenCalled();
    const [, options] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(options).toMatchObject({
      pageNumber: 1,
      sort: 'metadata.modifiedAt:desc',
      initialTotalCount: 1,
      initialRequest: {
        pageNumber: 1,
        sort: 'metadata.modifiedAt:desc',
        query: undefined,
      },
    });
  });

  it('renders H1 "Approval Dashboard" via the title translation key with no subheading', () => {
    mockApprovalsResult({ approvals: [buildApproval()] });
    render(<ApprovalsList initialApprovals={[buildApproval()]} />);

    expect(screen.getByRole('heading', { level: 1, name: 'title' })).toBeInTheDocument();
  });

  it('wraps the search, filter, table, and pagination in the shared table-card surface', () => {
    mockApprovalsResult({
      approvals: [buildApproval()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    const { container } = render(<ApprovalsList initialApprovals={[buildApproval()]} />);

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
    expect(tableCard?.querySelector('input')).not.toBeNull();
  });

  it('does not send a query when no search term or status filter is active', () => {
    mockApprovalsResult({ approvals: [] });
    render(<ApprovalsList initialApprovals={[]} />);

    const [, initialOptions] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(initialOptions.query).toBeUndefined();
  });

  it('scopes quick search to id/status/requestor/approver name fields and resets to page 1', () => {
    mockApprovalsResult({
      approvals: [buildApproval()],
      pagination: { pageNumber: 2, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<ApprovalsList initialApprovals={[buildApproval()]} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, options] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(options.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (status:~(ABC)) OR (requestor.firstName:~(abc)) OR (requestor.lastName:~(abc)) OR (approver.firstName:~(abc)) OR (approver.lastName:~(abc)))',
    );
    expect(options.pageNumber).toBe(1);
  });

  it('does not render a status filter dropdown', () => {
    mockApprovalsResult({ approvals: [buildApproval()] });
    render(<ApprovalsList initialApprovals={[buildApproval()]} />);

    expect(screen.queryByText('filterByStatus')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('waits for the debounced trimmed search to reset page 1 and clears the query once the field is emptied', () => {
    mockApprovalsResult({
      approvals: [buildApproval()],
      pagination: { pageNumber: 2, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<ApprovalsList initialApprovals={[buildApproval()]} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: '  abc  ' } });

    const [, optionsBeforeDebounce] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(optionsBeforeDebounce.pageNumber).toBe(2);
    expect(optionsBeforeDebounce.query).toBeUndefined();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, optionsAfterDebounce] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(optionsAfterDebounce.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (status:~(ABC)) OR (requestor.firstName:~(abc)) OR (requestor.lastName:~(abc)) OR (approver.firstName:~(abc)) OR (approver.lastName:~(abc)))',
    );
    expect(optionsAfterDebounce.pageNumber).toBe(1);

    fireEvent.change(input, { target: { value: '' } });

    const [, optionsAfterClearBeforeDebounce] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(optionsAfterClearBeforeDebounce.pageNumber).toBe(1);
    expect(optionsAfterClearBeforeDebounce.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (status:~(ABC)) OR (requestor.firstName:~(abc)) OR (requestor.lastName:~(abc)) OR (approver.firstName:~(abc)) OR (approver.lastName:~(abc)))',
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, optionsAfterDebouncedClear] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(optionsAfterDebouncedClear.query).toBeUndefined();
    expect(optionsAfterDebouncedClear.pageNumber).toBe(1);
  });

  it('never calls useApprovals with {new query, old page} while the debounced search settles', () => {
    mockApprovalsResult({
      approvals: [buildApproval()],
      pagination: { pageNumber: 2, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<ApprovalsList initialApprovals={[buildApproval()]} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const expectedQuery =
      'compoundLogicalQuery:((id:~(abc)) OR (status:~(ABC)) OR (requestor.firstName:~(abc)) OR (requestor.lastName:~(abc)) OR (approver.firstName:~(abc)) OR (approver.lastName:~(abc)))';

    const staleCombo = mockUseApprovals.mock.calls.find(
      ([, options]) => options.query === expectedQuery && options.pageNumber === 2,
    );
    expect(staleCombo).toBeUndefined();

    const [, settledOptions] = mockUseApprovals.mock.calls[mockUseApprovals.mock.calls.length - 1];
    expect(settledOptions.query).toBe(expectedQuery);
    expect(settledOptions.pageNumber).toBe(1);
  });

  it('renders the error state distinctly instead of the table when the fetch fails', () => {
    mockApprovalsResult({ approvals: [], error: new Error('boom') });
    render(<ApprovalsList initialApprovals={[]} />);

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a Try Again action in the error state that retries via refreshApprovals', () => {
    const refreshApprovals = jest.fn();
    mockUseApprovals.mockReturnValue({
      approvals: [],
      loading: false,
      error: new Error('boom'),
      pagination: undefined,
      refreshApprovals,
    });
    render(<ApprovalsList initialApprovals={[]} />);

    fireEvent.click(screen.getByText('tryAgain'));
    expect(refreshApprovals).toHaveBeenCalledTimes(1);
  });

  it('routes QUOTE approvals for designated approvers to the standalone approval page via the table', () => {
    const approval = buildApproval({
      id: 'approval-quote-1',
      resourceType: 'QUOTE',
      requestor: { userId: 'requestor-1', firstName: 'Requester', lastName: 'One', email: 'r@example.com' },
      approver: { userId: 'approver-1', firstName: 'Approver', lastName: 'One' },
    });
    mockApprovalsResult({ approvals: [approval] });

    render(<ApprovalsList initialApprovals={[approval]} currentUserId="approver-1" />);

    expect(screen.getByRole('link', { name: 'approval-quote-1' })).toHaveAttribute(
      'href',
      '/account/approval/approval-quote-1',
    );
  });

  it('keeps non-QUOTE approvals on the approval details route via the table', () => {
    const approval = buildApproval({
      id: 'approval-cart-1',
      resourceType: 'CART',
      resource: { id: 'cart-1' },
    });
    mockApprovalsResult({ approvals: [approval] });

    render(<ApprovalsList initialApprovals={[approval]} />);

    expect(screen.getByRole('link', { name: 'approval-cart-1' })).toHaveAttribute(
      'href',
      '/account/approvals/approval-cart-1',
    );
  });
});
