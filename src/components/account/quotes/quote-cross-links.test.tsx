/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import enAccountTranslations from '@/i18n/translations/en/account/index.json';
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

jest.mock('@/components/account/quotes/quote-summary', () => ({
  QuoteSummary: () => <div>QuoteSummary</div>,
}));

const mockProductListResolver = jest.fn(() => <div>ProductListResolver</div>);

jest.mock('@/components/product/product-list-resolver', () => ({
  ProductListResolver: (props: unknown) => mockProductListResolver(props),
}));

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
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

describe('Quote cross-links', () => {
  beforeEach(() => {
    mockHistory = [];
    mockCheckApprovalPermitted.mockReset();
    mockCheckApprovalPermitted.mockResolvedValue({ permitted: false, approvalId: 'approval-123' });
    mockProductListResolver.mockClear();
  });

  it('uses exact sentence case for the English Quote netValue label', () => {
    expect(enAccountTranslations.quoteDetails.netValue).toBe('Net value of goods');
  });

  it('anchors the action row flush to the right edge so it stays aligned with the Quote Details surface', () => {
    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    const requestChangeButton = screen.getByRole('button', { name: 'account.quoteDetails.requestChange' });
    const actionRow = requestChangeButton.parentElement;

    expect(actionRow).toHaveClass('ml-auto', 'justify-end');
    expect(screen.getByRole('button', { name: 'account.quoteDetails.reject' }).parentElement).toBe(actionRow);
    expect(screen.getByRole('button', { name: 'account.quoteDetails.accept' }).parentElement).toBe(actionRow);
  });

  it('forwards quote items to ProductListResolver with net-first resolver inputs, preserving the fetching contract', () => {
    render(<QuoteDetails quoteId={baseQuote.id} initialQuote={baseQuote} />);

    expect(mockProductListResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        showGrossUnderNet: true,
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
    expect(screen.getByText('account.quoteDetails.changeDate')).toBeInTheDocument();
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

  it('renders a related approval link when an existing approval id is already available from permission state', async () => {
    render(<QuoteDetails quoteId="quote-open-1" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.relatedApproval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'approval-123' })).toHaveAttribute(
      'href',
      '/account/approval/approval-123',
    );
  });

  it('omits related approval UI when existing permission state does not include an approval id', async () => {
    mockCheckApprovalPermitted.mockResolvedValueOnce({ permitted: true, approvalId: undefined });

    render(<QuoteDetails quoteId="quote-open-2" initialQuote={{ ...baseQuote, status: 'OPEN' }} />);

    expect(await screen.findByText('account.quoteDetails.totalAmount')).toBeInTheDocument();
    expect(screen.queryByText('account.quoteDetails.relatedApproval')).not.toBeInTheDocument();
  });
});
