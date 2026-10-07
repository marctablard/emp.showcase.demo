/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QuoteDetails } from './quote-details';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });

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

let mockRelatedApproval: {
  id: string;
  status: string;
  resourceType: string;
  action: string;
  resource: { id: string };
  requestor: { userId: string; firstName: string; lastName: string; email: string };
  approver: { userId: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
} | null = null;

jest.mock('@/hooks/approval/useApproval', () => ({
  useApproval: () => ({
    approval: mockRelatedApproval,
    loading: false,
    error: null,
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
    customer: { id: 'customer-1' },
    loading: false,
    error: null,
    fetchCustomer: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('@/components/account/quotes/quote-summary', () => ({
  QuoteSummary: ({
    relatedApprovalId,
    relatedApprovalHref,
  }: {
    relatedApprovalId?: string;
    relatedApprovalHref?: string;
  }) => (
    <div>
      QuoteSummary
      {relatedApprovalId ? <a href={relatedApprovalHref}>#{relatedApprovalId}</a> : null}
    </div>
  ),
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
    href?: string;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
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
  const originalFetch = global.fetch;
  const { ApprovalAlreadyExistsError } = jest.requireMock('@/platform/services/approval/errors') as {
    ApprovalAlreadyExistsError: new (approvalId: string, message?: string) => Error & { approvalId: string };
  };
  const { checkApprovalPermitted, createApproval, searchApprovalUsers } = jest.requireMock('@/lib/client/approval') as {
    checkApprovalPermitted: jest.Mock;
    createApproval: jest.Mock;
    searchApprovalUsers: jest.Mock;
  };
  const fetchMock = jest.fn();

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

  async function flushQuoteApprovalEffect() {
    await act(async () => {
      await Promise.resolve();
      const pending = checkApprovalPermitted.mock.results.at(-1)?.value;
      if (pending != null) {
        await Promise.resolve(pending).catch(() => undefined);
      }
    });
  }

  async function renderQuoteDetails(
    ui: React.ReactElement = <QuoteDetails quoteId="Q-1000" initialQuote={initialQuote as never} />,
  ) {
    const view = render(ui);
    await flushQuoteApprovalEffect();
    return view;
  }

  beforeEach(() => {
    checkApprovalPermitted.mockReset();
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });
    createApproval.mockReset();
    searchApprovalUsers.mockReset();
    notifyMock.mockReset();
    pushMock.mockReset();
    fetchMock.mockReset();
    mockProductListResolver.mockClear();
    mockRelatedApproval = null;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('passes locale and canonical presentation config to the shared product grid', async () => {
    await renderQuoteDetails();

    expect(mockProductListResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        showGrossUnderNet: true,
        presentationConfig: expect.objectContaining({
          showGrossSecondary: true,
          labels: expect.objectContaining({
            product: 'account.quoteDetails.product',
            quantity: 'account.quoteDetails.quantity',
            unitPrice: 'account.quoteDetails.unitPrice',
          }),
        }),
      }),
    );
  });

  it('routes to the linked approval when direct quote acceptance is not permitted', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-1',
    });

    await renderQuoteDetails();

    expect(await screen.findByRole('button', { name: 'account.quoteDetails.goToApproval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'account.quoteDetails.inquireApproval' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.goToApproval' }));

    await waitFor(() => {
      expect(checkApprovalPermitted).toHaveBeenLastCalledWith({
        resourceId: 'Q-1000',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
      });
    });

    expect(checkApprovalPermitted).toHaveBeenCalledTimes(2);

    expect(pushMock).toHaveBeenCalledWith('/account/approvals/approval-1');
  });

  it('opens an approver inquiry dialog and loads quote-scoped approvers when approval is required', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });
    searchApprovalUsers.mockResolvedValue([
      {
        userId: 'approver-2',
        firstName: 'Zoe',
        lastName: 'Washburne',
        fullName: 'Zoe Washburne',
      },
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ]);

    await renderQuoteDetails();

    expect(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.inquireApproval' }));

    await waitFor(() => {
      expect(searchApprovalUsers).toHaveBeenCalledWith('QUOTE', 'Q-1000', 'CHECKOUT');
    });

    expect(screen.getByText('checkout.approval.selectApprover')).toBeInTheDocument();

    const approverRows = screen.getAllByTestId(/^quote-approval-approver-approver-/);
    expect(approverRows[0]).toHaveTextContent('Ada Lovelace');
    expect(approverRows[1]).toHaveTextContent('Zoe Washburne');

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByText('0/500')).toBeInTheDocument();

    const submitButton = screen.getByTestId('quote-approval-submitButton');
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    expect(screen.getByRole('radio', { name: /Ada Lovelace/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Zoe Washburne/i })).not.toBeChecked();

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

    await renderQuoteDetails();

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

    await renderQuoteDetails();

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

    expect(pushMock).toHaveBeenCalledWith('/account/approvals/approval-1');
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

    await renderQuoteDetails();

    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' }));
    await screen.findByText('checkout.approval.selectApprover');

    fireEvent.click(screen.getByTestId('quote-approval-approver-approver-1'));
    fireEvent.click(screen.getByTestId('quote-approval-submitButton'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/account/approvals/approval-2');
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

    await renderQuoteDetails();

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

    await renderQuoteDetails();

    const acceptButton = await screen.findByRole('button', { name: 'account.quoteDetails.accept' });

    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText('account.quoteDetails.confirmationTitle')).toBeInTheDocument();
    });

    const quoteDetailsTitle = screen.getByText('account.quoteDetails.title');
    const confirmationTitle = screen.getByText('account.quoteDetails.confirmationTitle');
    const quoteHistoryTitle = screen.getByText('account.quoteDetails.quoteHistory');

    expect(
      quoteDetailsTitle.compareDocumentPosition(confirmationTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      confirmationTitle.compareDocumentPosition(quoteHistoryTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('focuses the accept comment textarea when the create-order panel opens', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    await renderQuoteDetails();

    const acceptButton = await screen.findByRole('button', { name: 'account.quoteDetails.accept' });

    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByLabelText('account.quoteDetails.yourComment')).toHaveFocus();
    });
  });

  it('focuses the reject comment textarea when the decline panel opens', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    await renderQuoteDetails();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.reject' }));

    await waitFor(() => {
      expect(screen.getByLabelText('account.quoteDetails.yourComment')).toHaveFocus();
    });
  });

  it('focuses the request-change comment textarea when the change panel opens', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    await renderQuoteDetails();

    fireEvent.click(screen.getByRole('button', { name: 'account.quoteDetails.requestChange' }));

    await waitFor(() => {
      expect(screen.getByLabelText('account.quoteDetails.yourComment')).toHaveFocus();
    });
  });

  it('shows a trimmed toast error and no inline alert when create-order fails', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error:
          'Failed to update quote Q1000396 (/status) failed with upstream status 400 Bad Request: Cannot create an order based on the quote: Q1000396 and tenant: showcasedev. Invalid information provided while trying to checkout. cart id is Q1000396',
      }),
    });

    await renderQuoteDetails();

    const acceptButton = await screen.findByRole('button', { name: 'account.quoteDetails.accept' });

    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });

    fireEvent.click(acceptButton);
    fireEvent.click(await screen.findByRole('button', { name: 'account.quoteDetails.createOrder' }));

    const trimmedMessage =
      'Cannot create an order based on the quote: Q1000396 and tenant: showcasedev. Invalid information provided while trying to checkout. cart id is Q1000396';

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith({
        title: 'account.quoteDetails.quoteActionFailedTitle',
        description: trimmedMessage,
        type: 'error',
      });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(trimmedMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to update quote Q1000396/)).not.toBeInTheDocument();
  });

  it('renders the decline form between quote details and history with a required reason selector and comment field', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    await renderQuoteDetails();

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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const quoteDetailsTitle = screen.getByText('account.quoteDetails.title');
    const rejectTitle = screen.getByText('account.quoteDetails.rejectConfirmationTitle');
    const quoteHistoryTitle = screen.getByText('account.quoteDetails.quoteHistory');

    expect(quoteDetailsTitle.compareDocumentPosition(rejectTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rejectTitle.compareDocumentPosition(quoteHistoryTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const rejectPanel = rejectTitle.closest('.bg-surface-page');

    expect(rejectPanel).not.toHaveClass('border-border-action');
  });

  it('renders the request-change form between quote details and history with a required reason selector and comment field', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: true,
    });

    await renderQuoteDetails();

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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'account.quoteDetails.requestChange' })[0]).toBeDisabled();

    const quoteDetailsTitle = screen.getByText('account.quoteDetails.title');
    const requestChangeTitle = screen.getByText('account.quoteDetails.requestChangeConfirmationTitle');
    const quoteHistoryTitle = screen.getByText('account.quoteDetails.quoteHistory');

    expect(
      quoteDetailsTitle.compareDocumentPosition(requestChangeTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      requestChangeTitle.compareDocumentPosition(quoteHistoryTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('clears the inquiry CTA synchronously when the quote transitions away from OPEN, without an extra permission request', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
    });

    const { rerender } = await renderQuoteDetails();

    expect(await screen.findByRole('button', { name: 'account.quoteDetails.inquireApproval' })).toBeInTheDocument();
    expect(checkApprovalPermitted).toHaveBeenCalledTimes(1);

    const acceptedQuote = { ...initialQuote, status: 'ACCEPTED' };
    rerender(<QuoteDetails quoteId="Q-1000" initialQuote={acceptedQuote as never} />);
    await flushQuoteApprovalEffect();

    expect(screen.queryByRole('button', { name: 'account.quoteDetails.inquireApproval' })).not.toBeInTheDocument();

    expect(screen.queryByTestId('quote-primaryButton')).not.toBeInTheDocument();

    expect(checkApprovalPermitted).toHaveBeenCalledTimes(1);
  });

  it('links Related Approval id via getApprovalHref for requestors (finding 21)', async () => {
    checkApprovalPermitted.mockResolvedValue({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-ellipsis-1',
    });
    mockRelatedApproval = {
      id: 'approval-ellipsis-1',
      status: 'PENDING',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
      resource: { id: 'Q-1000' },
      requestor: {
        userId: 'customer-1',
        firstName: 'Customer',
        lastName: 'One',
        email: 'customer@example.com',
      },
      approver: {
        userId: 'approver-1',
        firstName: 'Approver',
        lastName: 'One',
      },
      createdAt: '2026-05-31T10:00:00.000Z',
      updatedAt: '2026-05-31T10:00:00.000Z',
    };

    await renderQuoteDetails();

    const relatedApprovalLink = await screen.findByRole('link', { name: '#approval-ellipsis-1' });
    expect(relatedApprovalLink).toHaveAttribute('href', '/account/approvals/approval-ellipsis-1');
    expect(screen.getByRole('button', { name: 'account.quoteDetails.goToApproval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'account.quoteDetails.inquireApproval' })).not.toBeInTheDocument();
  });

  it('only shows a sort control on Change Date and defaults Quote History to DESC', async () => {
    await renderQuoteDetails();

    const sortButton = screen.getByTestId('quote-history-sort-change-date');
    expect(sortButton.parentElement).toHaveAttribute('aria-sort', 'descending');
    expect(sortButton.querySelector('svg')).not.toBeNull();

    const history = within(screen.getByText('account.quoteDetails.quoteHistory').closest('section') as HTMLElement);
    expect(history.getByText('account.quoteDetails.event').querySelector('svg')).toBeNull();
    expect(history.getByText('account.quoteDetails.changedBy').querySelector('svg')).toBeNull();
    expect(history.getByText('account.quoteDetails.status').querySelector('svg')).toBeNull();
    expect(history.getByText('account.quoteDetails.comment').querySelector('svg')).toBeNull();

    expect(screen.getByTestId('quote-history-row-initial')).toBeInTheDocument();
  });
});
