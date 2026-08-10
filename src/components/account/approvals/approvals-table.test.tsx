/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalsTable, getApprovalHref } from './approvals-table';

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

function buildApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'APR-1000',
    resourceType: 'QUOTE',
    action: 'CHECKOUT',
    status: 'PENDING',
    resource: {
      id: 'quote-1',
      orderId: 'order-1',
      subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 120, taxValue: 20 },
    },
    requestor: {
      userId: 'requestor-1',
      firstName: 'Requester',
      lastName: 'One',
      fullName: 'Requester One',
      email: 'r@example.com',
    },
    approver: { userId: 'approver-1', firstName: 'Approver', lastName: 'One', fullName: 'Approver One' },
    createdAt: '2026-05-31T10:00:00.000Z',
    modifiedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('ApprovalsTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the approval table with semantic table structure', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders columns in the contract order: Approval ID, Modified At, Status, Resource Type, Quote Number, Order Number, Net Total, Requestor, Approver, Created At, Action', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'approvalId',
      'modifiedAt',
      'status',
      'resourceType',
      'quoteNumber',
      'orderNumber',
      'netTotal',
      'requestor',
      'approver',
      'createdAt',
      'action',
    ]);
  });

  it('keeps only Quote Number, Order Number, and Action non-sortable; all other columns are sortable', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} />);

    for (const name of ['quoteNumber', 'orderNumber']) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
      expect(header).not.toHaveAttribute('aria-sort');
    }

    for (const name of [
      /approvalId/,
      /modifiedAt/,
      /^status$/,
      /resourceType/,
      /netTotal/,
      /requestor/,
      /approver/,
      /createdAt/,
    ]) {
      const header = screen.getByRole('columnheader', { name });
      expect(within(header).getByRole('button')).toBeInTheDocument();
    }
  });

  it('calls onToggleSort with the mapped field for each sortable column', () => {
    const onToggleSort = jest.fn();
    render(<ApprovalsTable approvals={[buildApproval()]} onToggleSort={onToggleSort} />);

    const cases: [RegExp, string][] = [
      [/approvalId/, 'approvalId'],
      [/^status$/, 'status'],
      [/resourceType/, 'resourceType'],
      [/netTotal/, 'netTotal'],
      [/requestor/, 'requestorFirstName'],
      [/approver/, 'approverFirstName'],
      [/createdAt/, 'createdAt'],
    ];

    for (const [name, expectedField] of cases) {
      const header = screen.getByRole('columnheader', { name });
      fireEvent.click(within(header).getByRole('button'));
      expect(onToggleSort).toHaveBeenLastCalledWith(expectedField);
    }
  });

  it('keeps the Action column non-sortable, centered, and arrow-only', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} />);

    const actionHeader = screen.getByRole('columnheader', { name: 'action' });
    expect(within(actionHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(actionHeader).not.toHaveAttribute('aria-sort');

    const arrowLink = screen.getByRole('link', { name: 'viewApprovalAriaLabel:APR-1000' });
    expect(arrowLink).toHaveTextContent('');
  });

  it('marks Modified At as descending-sorted by default and reflects the active sort field/direction', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} sortField="modifiedAt" sortDirection="desc" />);

    const modifiedAtHeader = screen.getByRole('columnheader', { name: /modifiedAt/ });
    expect(modifiedAtHeader).toHaveAttribute('aria-sort', 'descending');

    render(<ApprovalsTable approvals={[buildApproval()]} sortField="modifiedAt" sortDirection="asc" />);
    const modifiedAtHeaders = screen.getAllByRole('columnheader', { name: /modifiedAt/ });
    expect(modifiedAtHeaders[modifiedAtHeaders.length - 1]).toHaveAttribute('aria-sort', 'ascending');
  });

  it('calls onToggleSort when Modified At is clicked', () => {
    const onToggleSort = jest.fn();
    render(<ApprovalsTable approvals={[buildApproval()]} onToggleSort={onToggleSort} />);

    const modifiedAtHeader = screen.getByRole('columnheader', { name: /modifiedAt/ });
    fireEvent.click(within(modifiedAtHeader).getByRole('button'));

    expect(onToggleSort).toHaveBeenCalledWith('modifiedAt');
  });

  it('renders Net Total from resource.subtotalAggregate.netValue, never the gross value', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} />);

    const row = screen.getByText('APR-1000').closest('tr') as HTMLTableRowElement;
    expect(within(row).getByText('€100.00')).toBeInTheDocument();
    expect(within(row).queryByText('€120.00')).not.toBeInTheDocument();
  });

  it('renders Quote Number as resource.id for QUOTE approvals and "-" for CART approvals', () => {
    render(
      <ApprovalsTable
        approvals={[
          buildApproval({ id: 'quote-approval', resourceType: 'QUOTE', resource: { id: 'quote-42' } }),
          buildApproval({ id: 'cart-approval', resourceType: 'CART', resource: { id: 'cart-42' } }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'quote-42' })).toHaveAttribute('href', '/account/quotes/quote-42');
    const cartRow = screen.getByText('cart-approval').closest('tr') as HTMLTableRowElement;
    expect(within(cartRow).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('uses shared table-link styling for Approval ID, Quote Number, and Action links', () => {
    render(<ApprovalsTable approvals={[buildApproval({ id: 'APR-42', resource: { id: 'quote-42' } })]} />);

    const idLink = screen.getByRole('link', { name: 'APR-42' });
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

    const quoteLink = screen.getByRole('link', { name: 'quote-42' });
    expect(quoteLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
    expect(quoteLink).not.toHaveClass('underline');

    const arrowLink = screen.getByRole('link', { name: 'viewApprovalAriaLabel:APR-42' });
    expect(arrowLink).toHaveClass('no-underline', 'cursor-default', 'font-secondary', 'text-[16px]', 'leading-[24px]');
  });

  it('renders Order Number from resource.orderId regardless of resourceType, or "-" when absent', () => {
    render(
      <ApprovalsTable
        approvals={[
          buildApproval({ id: 'with-order', resource: { id: 'quote-1', orderId: 'order-99' } }),
          buildApproval({ id: 'without-order', resource: { id: 'quote-2' } }),
        ]}
      />,
    );

    expect(screen.getByText('order-99')).toBeInTheDocument();
    const withoutOrderRow = screen.getByText('without-order').closest('tr') as HTMLTableRowElement;
    expect(within(withoutOrderRow).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('displays Resource Type distinctly for CART and QUOTE', () => {
    render(
      <ApprovalsTable
        approvals={[
          buildApproval({ id: 'quote-approval', resourceType: 'QUOTE' }),
          buildApproval({ id: 'cart-approval', resourceType: 'CART' }),
        ]}
      />,
    );

    expect(
      within(screen.getByText('quote-approval').closest('tr') as HTMLTableRowElement).getByText('QUOTE'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('cart-approval').closest('tr') as HTMLTableRowElement).getByText('CART'),
    ).toBeInTheDocument();
  });

  it('navigates the full row, Approval ID link, and Action arrow to the same destination', () => {
    render(
      <ApprovalsTable
        approvals={[buildApproval({ id: 'APR-42', resourceType: 'CART', resource: { id: 'cart-1' } })]}
      />,
    );

    const row = screen.getByText('APR-42').closest('tr') as HTMLTableRowElement;
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith('/account/approvals/APR-42');

    const idLink = screen.getByRole('link', { name: 'APR-42' });
    expect(idLink).toHaveAttribute('href', '/account/approvals/APR-42');

    const arrowLink = screen.getByRole('link', { name: 'viewApprovalAriaLabel:APR-42' });
    expect(arrowLink).toHaveAttribute('href', '/account/approvals/APR-42');
  });

  it('does not trigger row navigation when the nested Approval ID or Action links are clicked', () => {
    render(<ApprovalsTable approvals={[buildApproval({ id: 'APR-42' })]} />);

    const idLink = screen.getByRole('link', { name: 'APR-42' });
    fireEvent.click(idLink);
    expect(push).not.toHaveBeenCalled();

    const arrowLink = screen.getByRole('link', { name: 'viewApprovalAriaLabel:APR-42' });
    fireEvent.click(arrowLink);
    expect(push).not.toHaveBeenCalled();
  });

  it('supports keyboard row navigation with Enter and Space', () => {
    render(<ApprovalsTable approvals={[buildApproval({ id: 'APR-42' })]} />);

    const row = screen.getByRole('row', { name: 'viewApprovalAriaLabel:APR-42' });

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/account/approvals/APR-42');

    push.mockClear();
    fireEvent.keyDown(row, { key: ' ' });
    expect(push).toHaveBeenCalledWith('/account/approvals/APR-42');
  });

  it('does not row-navigate when Enter or Space is pressed on nested links', () => {
    render(<ApprovalsTable approvals={[buildApproval({ id: 'APR-42', resource: { id: 'quote-42' } })]} />);

    const idLink = screen.getByRole('link', { name: 'APR-42' });
    fireEvent.keyDown(idLink, { key: 'Enter' });
    fireEvent.keyDown(idLink, { key: ' ' });
    expect(push).not.toHaveBeenCalled();

    const quoteLink = screen.getByRole('link', { name: 'quote-42' });
    fireEvent.keyDown(quoteLink, { key: 'Enter' });
    fireEvent.keyDown(quoteLink, { key: ' ' });
    expect(push).not.toHaveBeenCalled();

    const arrowLink = screen.getByRole('link', { name: 'viewApprovalAriaLabel:APR-42' });
    fireEvent.keyDown(arrowLink, { key: 'Enter' });
    fireEvent.keyDown(arrowLink, { key: ' ' });
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the empty-approvals message when there are no approvals and no active search', () => {
    render(<ApprovalsTable approvals={[]} hasActiveSearch={false} />);
    expect(screen.getByText('noApprovalsFound')).toBeInTheDocument();
    expect(screen.queryByText('noMatches')).not.toBeInTheDocument();
  });

  it('shows the no-matches message instead of the empty-approvals message when a search is active and there are no results', () => {
    render(<ApprovalsTable approvals={[]} hasActiveSearch />);
    expect(screen.getByText('noMatches')).toBeInTheDocument();
    expect(screen.queryByText('noApprovalsFound')).not.toBeInTheDocument();
  });

  it('keeps rows mounted and dimmed while reloading, showing a spinner only on the active sort column', () => {
    render(<ApprovalsTable approvals={[buildApproval()]} loading sortField="modifiedAt" sortDirection="desc" />);

    expect(screen.getByText('APR-1000')).toBeInTheDocument();
    expect(screen.queryByText('noApprovalsFound')).not.toBeInTheDocument();

    const modifiedAtHeader = screen.getByRole('columnheader', { name: /modifiedAt/ });
    expect(within(modifiedAtHeader).getByRole('status')).toBeInTheDocument();

    const statusHeader = screen.getByRole('columnheader', { name: /^status$/ });
    expect(within(statusHeader).queryByRole('status')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table.closest('[data-slot="table-container"]')?.parentElement).toHaveClass('opacity-70');
  });

  it('does not flash the empty state while reloading and no rows have loaded yet', () => {
    render(<ApprovalsTable approvals={[]} loading />);
    expect(screen.queryByText('noApprovalsFound')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1); // header row only
  });

  it('never prefixes Approval ID, Quote Number, or Order Number identifiers with "#"', () => {
    render(
      <ApprovalsTable
        approvals={[
          buildApproval({ id: 'APR-77', resourceType: 'QUOTE', resource: { id: 'quote-77', orderId: 'order-77' } }),
        ]}
      />,
    );

    const row = screen.getByText('APR-77').closest('tr') as HTMLTableRowElement;
    expect(within(row).queryByText(/#/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'APR-77' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'quote-77' })).toBeInTheDocument();
    expect(screen.getByText('order-77')).toBeInTheDocument();
  });
});

describe('getApprovalHref', () => {
  it('routes QUOTE approvals to the canonical approval details page for designated approvers', () => {
    const approval = buildApproval({
      resourceType: 'QUOTE',
      requestor: { userId: 'requestor-1', firstName: 'R', lastName: 'One', email: 'r@example.com' },
      approver: { userId: 'approver-1', firstName: 'A', lastName: 'One' },
    });

    expect(getApprovalHref(approval, 'approver-1')).toBe('/account/approvals/APR-1000');
  });

  it('routes QUOTE approvals to the canonical approval details page for requestors', () => {
    const approval = buildApproval({
      resourceType: 'QUOTE',
      requestor: { userId: 'shared-user', firstName: 'Shared', lastName: 'User', email: 's@example.com' },
      approver: { userId: 'shared-user', firstName: 'Shared', lastName: 'User' },
      resource: { id: 'quote-shared' },
    });

    expect(getApprovalHref(approval, 'shared-user')).toBe('/account/approvals/APR-1000');
  });

  it('routes non-QUOTE approvals to the approval details route', () => {
    const approval = buildApproval({ resourceType: 'CART' });

    expect(getApprovalHref(approval, 'approver-1')).toBe('/account/approvals/APR-1000');
  });
});
