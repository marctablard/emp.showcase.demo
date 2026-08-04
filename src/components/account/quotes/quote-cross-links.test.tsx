/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import enAccountTranslations from '@/i18n/translations/en/account/index.json';
import type { Approval } from '@/platform/services/model/approval';
import type { Quote } from '@/platform/services/model/quote';
import { QuoteDetails } from './quote-details';
import { QuotesTable } from './quotes-table';

let mockHistory: Array<{
  id: string;
  userFullName: string;
  comment: string;
  modifiedAt: string;
  rawModifiedAt?: string;
  fieldChanged: string;
  statusValue?: string;
  quoteReason?: string;
}> = [];

const mockCheckApprovalPermitted = jest.fn();

let mockRelatedApproval: Approval | null = null;
let mockRelatedApprovalLoading = false;
let mockRelatedApprovalError: Error | null = null;
let mockCustomer: { id: string } | null = { id: 'customer-1' };

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translate = (key: string, values?: Record<string, string>) => {
      if (namespace === 'account.quoteDetails' && key === 'statusChanged') {
        return `Status Changed to ${values?.currentStatus}`;
      }

      if (namespace === 'account.quoteStatus' && key === 'in_progress') {
        return 'In Progress';
      }

      if (namespace === 'account.quoteDetails' && key === 'reason') {
        return 'Reason';
      }

      if (namespace === 'account.quoteDetails' && key.startsWith('decisionReasons.')) {
        return key.replace('decisionReasons.', '');
      }

      return `${namespace}.${key}`;
    };

    translate.has = (key: string) => namespace === 'account.quoteDetails' && key.startsWith('decisionReasons.');

    return translate;
  },
  useLocale: () => 'de-DE',
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/quotes/useQuotes', () => ({
  useQuote: () => ({
    quote: null,
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/quotes/useQuoteHistory', () => ({
  useQuoteHistory: () => ({
    history: mockHistory,
    loading: false,
  }),
}));

jest.mock('@/hooks/approval/useApproverSearch', () => ({
  useApproverSearch: () => ({
    approvers: undefined,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/approval/useApproval', () => ({
  useApproval: () => ({
    approval: mockRelatedApproval,
    loading: mockRelatedApprovalLoading,
    error: mockRelatedApprovalError,
    updateApprovalStatus: jest.fn(),
    updateApproverComment: jest.fn(),
    updateRequestorComment: jest.fn(),
    deleteApproval: jest.fn(),
    refreshApproval: jest.fn(),
  }),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({
    customer: mockCustomer,
    loading: false,
    error: null,
    fetchCustomer: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('@/components/account/quotes/quote-summary', () => ({
  QuoteSummary: () => <div>QuoteSummary</div>,
}));

const mockProductListResolver = jest.fn((_props: unknown) => <div>ProductListResolver</div>);

jest.mock('@/components/product/product-list-resolver', () => ({
  ProductListResolver: (props: unknown) => mockProductListResolver(props),
}));

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
    title,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/client/approval', () => ({
  checkApprovalPermitted: (...args: unknown[]) => mockCheckApprovalPermitted(...args),
  createApproval: jest.fn(),
}));

const baseQuote: Quote = {
  id: 'Q-1000',
  status: 'ACCEPTED',
  reference: 'Quote Ref',
  submittedDate: '2026-05-31T10:00:00.000Z',
  customerId: 'customer-1',
  customerName: 'Ada Lovelace',
  currency: 'EUR',
  totalGross: 120,
  totalNet: 100,
  totalVat: 20,
  items: [
    {
      quantity: { quantity: 1, unitCode: 'EA' },
      product: {
        id: 'product-1',
        quantity: 1,
        itemPrice: {
          amount: 120,
          currency: 'EUR',
          baseAmount: 100,
          tax: 20,
          grossValue: 120,
          netValue: 100,
        },
      },
    },
  ],
  shippingAddress: {
    type: 'SHIPPING',
    contactName: 'Ada Lovelace',
    street: 'Main Street 1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'Germany',
  },
  shippingCost: 0,
  shippingMethod: 'standard',
};

function buildRelatedApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'approval-123',
    status: 'PENDING',
    resourceType: 'QUOTE',
    action: 'CHECKOUT',
    resource: { id: 'quote-open-1' },
    requestor: {
      userId: 'customer-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    },
    approver: {
      userId: 'approver-1',
      firstName: 'Approver',
      lastName: 'One',
    },
    createdAt: '2026-05-31T10:00:00.000Z',
    updatedAt: '2026-05-31T10:00:00.000Z',
    ...overrides,
  };
}

describe('Quote cross-links', () => {
  beforeEach(() => {
    mockHistory = [];
    mockCheckApprovalPermitted.mockReset();
    mockCheckApprovalPermitted.mockResolvedValue({ permitted: false, approvalId: 'approval-123' });
    mockProductListResolver.mockClear();
    mockRelatedApproval = buildRelatedApproval();
    mockRelatedApprovalLoading = false;
    mockRelatedApprovalError = null;
    mockCustomer = { id: 'customer-1' };
  });

  it('uses exact sentence case for the English Quote netValue label', () => {
    expect(enAccountTranslations.quoteDetails.netValue).toBe('Net value of goods');
  });

  it('stacks Quote header actions one-per-line on mobile and keeps them on one band from sm', () => {
    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    const header = screen.getByTestId('quote-detail-header');
    expect(header).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'sm:items-center', 'sm:justify-between');

    const actions = screen.getByTestId('quote-detail-header-actions');
    expect(actions).toHaveClass('flex', 'w-full', 'flex-col', 'gap-4', 'sm:w-auto', 'sm:flex-row');
    expect(screen.getByRole('button', { name: 'account.quoteDetails.reject' }).parentElement).toBe(actions);
    expect(screen.getByRole('button', { name: 'account.quoteDetails.accept' }).parentElement).toBe(actions);
    expect(screen.getByRole('button', { name: 'account.quoteDetails.requestChange' }).parentElement).toBe(actions);
  });

  it('forwards quote items to ProductListResolver with locale-aware canonical presentation config and net-first resolver inputs', () => {
    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    expect(mockProductListResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'de-DE',
        showGrossUnderNet: true,
        presentationConfig: expect.objectContaining({
          showGrossSecondary: true,
          labels: expect.objectContaining({
            product: 'account.quoteDetails.product',
            quantity: 'account.quoteDetails.quantity',
            unitPrice: 'account.quoteDetails.unitPrice',
          }),
        }),
        items: [
          expect.objectContaining({
            productId: 'product-1',
            quantity: 1,
            unitPrice: 120,
            currency: 'EUR',
            grossUnitPrice: 120,
            netUnitPrice: 100,
          }),
        ],
      }),
    );
  });

  it('renders the related order link in the standalone list column and on the detail view when orderId is present', () => {
    const quoteWithOrder = { ...baseQuote, orderId: 'order-123' };

    render(
      <>
        <QuotesTable quotes={[quoteWithOrder]} />
        <QuoteDetails quoteId={quoteWithOrder.id} initialQuote={quoteWithOrder} />
      </>,
    );

    expect(screen.getByRole('columnheader', { name: /account\.quotesList\.relatedOrder/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'order-123' })[0]).toHaveAttribute('href', '/account/orders/order-123');
    expect(screen.getByText('account.quoteDetails.relatedOrder')).toBeInTheDocument();
  });

  it('omits the related order link (but keeps the standalone column) when orderId is absent', () => {
    render(
      <>
        <QuotesTable quotes={[baseQuote]} />
        <QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />
      </>,
    );

    expect(screen.getByRole('columnheader', { name: /account\.quotesList\.relatedOrder/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'order-123' })).not.toBeInTheDocument();
    expect(screen.queryByText('account.quoteDetails.relatedOrder')).not.toBeInTheDocument();
  });

  it('renders quote history with the changed-to status, visible reason/comment, and timestamp including time', () => {
    mockHistory = [
      {
        id: 'history-1',
        userFullName: 'Ada Lovelace (CUSTOMER)',
        comment: 'Please adjust delivery window',
        modifiedAt: '2026-06-02T14:35:00.000Z',
        rawModifiedAt: '2026-06-02T14:35:00.000Z',
        fieldChanged: '/status',
        statusValue: 'IN_PROGRESS',
        quoteReason: 'DELIVERY_TIME_LATE',
      },
    ];

    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    expect(screen.getByText('Ada Lovelace (CUSTOMER)')).toBeInTheDocument();
    expect(screen.getByText('Status Changed to In Progress')).toBeInTheDocument();
    expect(screen.getByText(/Please adjust delivery window/)).toBeInTheDocument();
    expect(screen.getByText('account.quoteDetails.quoteHistory')).toBeInTheDocument();
    expect(screen.getByTestId('quote-history-sort-change-date')).toHaveTextContent('account.quoteDetails.changeDate');
    expect(screen.getByText('account.quoteDetails.event')).toBeInTheDocument();
    expect(screen.getByText('account.quoteDetails.changedBy')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'P' && Boolean(element.textContent?.includes('DELIVERY_TIME_LATE')),
      ),
    ).toBeInTheDocument();

    const historyTimestamp = screen.getByText(/02\.06\.2026/);

    expect(historyTimestamp).toHaveTextContent(/\d{2}:\d{2}/);
  });

  it('ellipsizes the related approval id while linking via getApprovalHref for requestors (finding 21)', async () => {
    render(<QuoteDetails quoteId="quote-open-1" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.relatedApproval')).toBeInTheDocument();

    const relatedApprovalLink = screen.getByRole('link', { name: 'approval-123' });
    // Requestor (customer-1) must not bounce through /account/approval/{id}
    expect(relatedApprovalLink).toHaveAttribute('href', '/account/quotes/quote-open-1');
    expect(relatedApprovalLink).not.toHaveAttribute('href', '/account/approval/approval-123');
    expect(relatedApprovalLink).toHaveClass('block', 'min-w-0', 'max-w-full', 'truncate');
    expect(relatedApprovalLink.parentElement).toHaveClass('min-w-0');
    expect(relatedApprovalLink.parentElement).toHaveAttribute('title', 'approval-123');
  });

  it('routes Related Approval to the approval page for designated approvers via getApprovalHref', async () => {
    mockCustomer = { id: 'approver-1' };
    mockRelatedApproval = buildRelatedApproval();

    render(<QuoteDetails quoteId="quote-open-1" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.relatedApproval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'approval-123' })).toHaveAttribute(
      'href',
      '/account/approval/approval-123',
    );
  });

  it('renders Related Approval as plain text while useApproval is loading (non-bounce fallback)', async () => {
    mockRelatedApproval = null;
    mockRelatedApprovalLoading = true;

    render(<QuoteDetails quoteId="quote-open-1" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.relatedApproval')).toBeInTheDocument();
    expect(screen.getByText('approval-123')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'approval-123' })).not.toBeInTheDocument();
  });

  it('renders Related Approval as plain text when useApproval errors (non-bounce fallback)', async () => {
    mockRelatedApproval = null;
    mockRelatedApprovalLoading = false;
    mockRelatedApprovalError = new Error('Failed to get approval');

    render(<QuoteDetails quoteId="quote-open-1" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.relatedApproval')).toBeInTheDocument();
    expect(screen.getByText('approval-123')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'approval-123' })).not.toBeInTheDocument();
  });

  it('omits related approval UI when existing permission state does not include an approval id', async () => {
    mockCheckApprovalPermitted.mockResolvedValueOnce({ permitted: true, approvalId: undefined });
    mockRelatedApproval = null;

    render(<QuoteDetails quoteId="quote-open-2" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.totalAmount')).toBeInTheDocument();
    expect(screen.queryByText('account.quoteDetails.relatedApproval')).not.toBeInTheDocument();
  });

  it('makes Change Date the only sortable Quote History column and defaults to DESC', () => {
    mockHistory = [
      {
        id: 'history-older',
        userFullName: 'Older User',
        comment: 'Older change',
        modifiedAt: '2026-06-01T10:00:00.000Z',
        rawModifiedAt: '2026-06-01T10:00:00.000Z',
        fieldChanged: '/status',
        statusValue: 'IN_PROGRESS',
      },
      {
        id: 'history-newer',
        userFullName: 'Newer User',
        comment: 'Newer change',
        modifiedAt: '2026-06-03T10:00:00.000Z',
        rawModifiedAt: '2026-06-03T10:00:00.000Z',
        fieldChanged: '/status',
        statusValue: 'ACCEPTED',
      },
    ];

    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    const sortButton = screen.getByTestId('quote-history-sort-change-date');
    expect(sortButton).toBeInTheDocument();
    expect(sortButton.parentElement).toHaveAttribute('aria-sort', 'descending');
    expect(sortButton.querySelector('svg')).not.toBeNull();

    const eventHeading = screen.getByText('account.quoteDetails.event');
    const changedByHeading = screen.getByText('account.quoteDetails.changedBy');
    const statusHeading = screen.getByText('account.quoteDetails.status');
    const commentHeading = screen.getByText('account.quoteDetails.comment');

    expect(eventHeading.closest('button')).toBeNull();
    expect(changedByHeading.closest('button')).toBeNull();
    expect(statusHeading.closest('button')).toBeNull();
    expect(commentHeading.closest('button')).toBeNull();
    expect(eventHeading.querySelector('svg')).toBeNull();
    expect(changedByHeading.querySelector('svg')).toBeNull();
    expect(statusHeading.querySelector('svg')).toBeNull();
    expect(commentHeading.querySelector('svg')).toBeNull();

    expect(screen.queryByRole('button', { name: /account\.quoteDetails\.event/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account\.quoteDetails\.changedBy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account\.quoteDetails\.status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account\.quoteDetails\.comment/ })).not.toBeInTheDocument();

    const historyRows = screen.getAllByTestId(/quote-history-row-/);
    expect(historyRows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'quote-history-row-history-newer',
      'quote-history-row-history-older',
      'quote-history-row-initial',
    ]);

    fireEvent.click(sortButton);

    expect(sortButton.parentElement).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByTestId(/quote-history-row-/).map((row) => row.getAttribute('data-testid'))).toEqual([
      'quote-history-row-initial',
      'quote-history-row-history-older',
      'quote-history-row-history-newer',
    ]);
  });
});
