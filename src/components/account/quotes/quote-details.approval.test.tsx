/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuoteDetails } from './quote-details';

const notifyMock = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}));

const pushMock = jest.fn();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: pushMock,
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
    history: [],
    loading: false,
  }),
}));

jest.mock('@/components/account/quotes/quote-summary', () => ({
  QuoteSummary: () => <div>QuoteSummary</div>,
}));

jest.mock('@/components/product/product-list-resolver', () => ({
  ProductListResolver: () => <div>ProductListResolver</div>,
}));

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/platform/services/approval/errors', () => ({
  ApprovalAlreadyExistsError: class ApprovalAlreadyExistsError extends Error {
    approvalId: string;

    constructor(approvalId: string, message: string = 'Approval already exists') {
      super(message);
      this.name = 'ApprovalAlreadyExistsError';
      this.approvalId = approvalId;
    }
  },
}));

jest.mock('@/lib/client/approval', () => ({
  checkApprovalPermitted: jest.fn(),
  createApproval: jest.fn(),
  searchApprovalUsers: jest.fn(),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: {
    Success: 'success',
    Error: 'error',
  },
  notify: (...args: unknown[]) => notifyMock(...args),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

describe('QuoteDetails approval flow', () => {
  const { ApprovalAlreadyExistsError } = jest.requireMock('@/platform/services/approval/errors') as {
    ApprovalAlreadyExistsError: new (approvalId: string, message?: string) => Error & { approvalId: string };
  };
  const { checkApprovalPermitted, createApproval, searchApprovalUsers } = jest.requireMock('@/lib/client/approval') as {
    checkApprovalPermitted: jest.Mock;
    createApproval: jest.Mock;
    searchApprovalUsers: jest.Mock;
  };

  const initialQuote = {
    id: 'Q-1000',
    status: 'OPEN',
    reference: 'Quote Ref',
    totalGross: 120,
    currency: 'EUR',
    submittedDate: '2026-05-31T10:00:00.000Z',
    customerName: 'Customer',
    customerId: 'customer-1',
    approverName: 'Approver',
    items: [
      {
        quantity: { quantity: 1 },
        product: {
          id: 'product-1',
          itemPrice: { amount: 120, currency: 'EUR' },
        },
      },
    ],
  };

  beforeEach(() => {
    checkApprovalPermitted.mockReset();
    createApproval.mockReset();
    searchApprovalUsers.mockReset();
    notifyMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes to the linked approval when direct quote acceptance is not permitted', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-1',
    });

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    expect(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.inquireApproval' }));

    await waitFor(() => {
      expect(checkApprovalPermitted).toHaveBeenLastCalledWith({
        resourceId: 'Q-1000',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
      });
    });

    expect(checkApprovalPermitted).toHaveBeenCalledTimes(2);

    expect(pushMock).toHaveBeenCalledWith('/account/approval/approval-1');
  });

  it('opens an approver inquiry dialog and loads quote-scoped approvers when approval is required', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    expect(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.inquireApproval' }));

    await waitFor(() => {
      expect(searchApprovalUsers).toHaveBeenCalledWith('QUOTE', 'Q-1000', 'CHECKOUT');
    });

    expect(screen.getByText('checkout.approval.selectApprover')).toBeInTheDocument();

    const submitButton = screen.getByTestId('quote-approval-submitButton');
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('keeps the inquiry submit action disabled until an approver is selected', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' }));

    await waitFor(() => {
      expect(screen.getByTestId('quote-approval-submitButton')).toBeDisabled();
    });
  });

  it('creates a quote approval from the inquiry dialog and routes to the linked approval', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);
    createApproval.mockResolvedValue({ id: 'approval-1' });

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' }));
    await screen.findByText('checkout.approval.selectApprover');

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));
    fireEvent.change(screen.getByTestId('quote-approval-comment'), { target: { value: 'Please approve' } });
    fireEvent.click(screen.getByTestId('quote-approval-submitButton'));

    await waitFor(() => {
      expect(createApproval).toHaveBeenCalledWith({
        resourceType: 'QUOTE',
        resourceId: 'Q-1000',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
        comment: 'Please approve',
      });
    });

    expect(pushMock).toHaveBeenCalledWith('/account/approval/approval-1');
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('routes to the existing approval when the create request returns a duplicate response', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);
    createApproval.mockRejectedValue(new ApprovalAlreadyExistsError('approval-2'));

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' }));
    await screen.findByText('checkout.approval.selectApprover');

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));
    fireEvent.click(screen.getByTestId('quote-approval-submitButton'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/account/approval/approval-2');
    });

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and reports an error when approval creation fails', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);
    createApproval.mockRejectedValue(new Error('boom'));

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' }));
    await screen.findByText('checkout.approval.selectApprover');

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));
    fireEvent.click(screen.getByTestId('quote-approval-submitButton'));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith({
        title: 'account.quoteDetails.quoteActionFailedTitle',
        description: 'boom',
        type: 'error',
      });
    });

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows the direct accept confirmation when approval is not required', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    const acceptButton = await screen.findByRole('button', { name: 'account.quoteDetails.accept' });

    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText('account.quoteDetails.confirmationTitle')).toBeInTheDocument();
    });
  });

  it('opens a decline dialog with a required reason selector and comment field', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    await waitFor(() => {
      expect(checkApprovalPermitted).toHaveBeenCalledWith({
        resourceId: 'Q-1000',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.reject' }));

    expect(screen.getByText('account.quoteDetails.rejectConfirmationTitle')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'account.quoteDetails.decisionReasonLabel' })).toBeInTheDocument();
    expect(screen.getByLabelText('account.quoteDetails.yourComment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.quoteDetails.rejectQuote' })).toBeDisabled();
  });

  it('opens a request-change dialog with a required reason selector and comment field', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    render(<QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />);

    await waitFor(() => {
      expect(checkApprovalPermitted).toHaveBeenCalledWith({
        resourceId: 'Q-1000',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.requestChange' }));

    expect(screen.getByText('account.quoteDetails.requestChangeConfirmationTitle')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'account.quoteDetails.decisionReasonLabel' })).toBeInTheDocument();
    expect(screen.getByLabelText('account.quoteDetails.yourComment')).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('button[type="button"], button')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'account.quoteDetails.requestChange' })).toBeDisabled();
  });
});
