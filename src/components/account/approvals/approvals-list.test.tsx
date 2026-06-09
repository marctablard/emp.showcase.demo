/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalsList } from './approvals-list';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en-US',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

jest.mock('@/hooks/approval/useApprovals', () => ({
  useApprovals: (initialApprovals?: Approval[]) => ({
    approvals: initialApprovals ?? [],
    loading: false,
    error: null,
    filterApprovals: jest.fn(),
    refreshApprovals: jest.fn(),
  }),
}));

describe('ApprovalsList', () => {
  it('renders QUOTE approvals without checkout detail fields and preserves CART rows', () => {
    const approvals: Approval[] = [
      {
        id: 'approval-quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        status: 'PENDING',
        resource: { id: 'quote-1', orderId: 'order-1' },
        requestor: { userId: 'requestor-1', firstName: 'Requester', lastName: 'One', fullName: 'Requester One' },
        approver: { userId: 'approver-1', firstName: 'Approver', lastName: 'One', fullName: 'Approver One' },
        createdAt: '2026-06-01T10:00:00.000Z',
        modifiedAt: '2026-06-02T10:00:00.000Z',
      },
      {
        id: 'approval-cart-1',
        resourceType: 'CART',
        action: 'CHECKOUT',
        status: 'APPROVED',
        resource: { id: 'cart-1' },
        requestor: { userId: 'requestor-2' },
        approver: { userId: 'approver-2', firstName: 'Approver', lastName: 'Two', fullName: 'Approver Two' },
        createdAt: '2026-05-31T10:00:00.000Z',
        modifiedAt: '2026-05-31T10:00:00.000Z',
      },
    ];

    render(<ApprovalsList initialApprovals={approvals} />);

    expect(screen.getByText('resourceType')).toBeInTheDocument();
    expect(screen.getByText('QUOTE')).toBeInTheDocument();
    expect(screen.getByText('CART')).toBeInTheDocument();
    expect(screen.getByText('quoteId')).toBeInTheDocument();
    expect(screen.getByText('orderId')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'quote-1' })).toHaveAttribute('href', '/account/quotes/quote-1');
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('Requester One')).toBeInTheDocument();
    expect(screen.getByText('Approver One')).toBeInTheDocument();
    const quoteRow = screen.getByText('approval-quote-1').closest('tr');
    const cartRow = screen.getByText('approval-cart-1').closest('tr');

    expect(quoteRow).not.toBeNull();
    expect(within(quoteRow as HTMLTableRowElement).getByRole('link', { name: 'view' })).toHaveAttribute(
      'href',
      '/account/quotes/quote-1',
    );
    expect(cartRow).not.toBeNull();
    expect(within(cartRow as HTMLTableRowElement).getAllByText('-')).toHaveLength(2);
  });

  it('routes QUOTE approvals for designated approvers to the company approval page', () => {
    const approvals: Approval[] = [
      {
        id: 'approval-quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        status: 'PENDING',
        resource: { id: 'quote-1' },
        requestor: { userId: 'requestor-1', firstName: 'Requester', lastName: 'One', fullName: 'Requester One' },
        approver: { userId: 'approver-1', firstName: 'Approver', lastName: 'One', fullName: 'Approver One' },
        createdAt: '2026-06-01T10:00:00.000Z',
        modifiedAt: '2026-06-01T10:00:00.000Z',
      },
    ];

    render(<ApprovalsList initialApprovals={approvals} currentUserId="approver-1" />);

    expect(screen.getByRole('link', { name: 'view' })).toHaveAttribute('href', '/account/approval/approval-quote-1');
  });

  it('keeps QUOTE approvals on the quote page for requestors even when they are also the approver', () => {
    const approvals: Approval[] = [
      {
        id: 'approval-quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        status: 'PENDING',
        resource: { id: 'quote-1' },
        requestor: { userId: 'shared-user', firstName: 'Shared', lastName: 'User', fullName: 'Shared User' },
        approver: { userId: 'shared-user', firstName: 'Shared', lastName: 'User', fullName: 'Shared User' },
        createdAt: '2026-06-01T10:00:00.000Z',
        modifiedAt: '2026-06-01T10:00:00.000Z',
      },
    ];

    render(<ApprovalsList initialApprovals={approvals} currentUserId="shared-user" />);

    expect(screen.getByRole('link', { name: 'view' })).toHaveAttribute('href', '/account/quotes/quote-1');
  });

  it('keeps non-QUOTE approvals on the requester approval details route', () => {
    const approvals: Approval[] = [
      {
        id: 'approval-cart-1',
        resourceType: 'CART',
        action: 'CHECKOUT',
        status: 'APPROVED',
        resource: { id: 'cart-1' },
        requestor: { userId: 'requestor-2' },
        approver: { userId: 'approver-2', firstName: 'Approver', lastName: 'Two', fullName: 'Approver Two' },
        createdAt: '2026-05-31T10:00:00.000Z',
        modifiedAt: '2026-05-31T10:00:00.000Z',
      },
    ];

    render(<ApprovalsList initialApprovals={approvals} />);

    expect(screen.getByRole('link', { name: 'view' })).toHaveAttribute('href', '/account/approvals/approval-cart-1');
  });

  it('sorts approvals by modifiedAt descending before rendering', () => {
    const approvals: Approval[] = [
      {
        id: 'approval-older',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        status: 'PENDING',
        resource: { id: 'quote-older' },
        requestor: { userId: 'requestor-1', fullName: 'Requester One', firstName: 'Requester', lastName: 'One' },
        approver: { userId: 'approver-1', fullName: 'Approver One', firstName: 'Approver', lastName: 'One' },
        createdAt: '2026-06-01T10:00:00.000Z',
        modifiedAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'approval-newer',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        status: 'PENDING',
        resource: { id: 'quote-newer' },
        requestor: { userId: 'requestor-2', fullName: 'Requester Two', firstName: 'Requester', lastName: 'Two' },
        approver: { userId: 'approver-2', fullName: 'Approver Two', firstName: 'Approver', lastName: 'Two' },
        createdAt: '2026-05-01T10:00:00.000Z',
        modifiedAt: '2026-06-02T10:00:00.000Z',
      },
    ];

    render(<ApprovalsList initialApprovals={approvals} />);

    const dataRows = screen.getAllByRole('row').slice(1);

    expect(within(dataRows[0] as HTMLTableRowElement).getByText('approval-newer')).toBeInTheDocument();
    expect(within(dataRows[1] as HTMLTableRowElement).getByText('approval-older')).toBeInTheDocument();
  });
});
