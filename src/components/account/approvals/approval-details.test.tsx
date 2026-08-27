/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { checkoutApproval } from '@/lib/client/checkout';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalDetails } from './approval-details';

const refreshApproval = jest.fn();
const updateApprovalStatus = jest.fn();
const updateApproverComment = jest.fn();
const updateRequestorComment = jest.fn();
const notifyMock = jest.fn();
const checkoutApprovalMock = checkoutApproval as jest.MockedFunction<typeof checkoutApproval>;

const baseApproval: Approval = {
  id: 'approval-requestor-1',
  status: 'PENDING',
  resourceType: 'QUOTE',
  action: 'CHECKOUT',
  resource: {
    id: 'Q-1000',
    items: [
      {
        productId: 'product-1',
        quantity: 3,
        itemPrice: {
          currency: 'EUR',
          amount: 10,
          netValue: 10,
        },
      },
    ],
  },
  requestor: {
    userId: 'requestor-1',
    firstName: 'Requester',
    lastName: 'One',
    email: 'requestor@example.com',
  },
  approver: {
    userId: 'approver-1',
    firstName: 'Approver',
    lastName: 'One',
  },
  createdAt: '2026-06-03T07:09:38.112Z',
  updatedAt: '2026-06-03T07:10:38.112Z',
  comment: 'request comment',
};

let mockApproval: Approval | null = baseApproval;
let mockLoading = false;
let mockError: Error | null = null;
let mockCustomer: { id: string } | null = { id: 'requestor-1' };
let mockCustomerLoading = false;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'de-DE',
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/approval/useApproval', () => ({
  useApproval: () => ({
    approval: mockApproval,
    loading: mockLoading,
    error: mockError,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    refreshApproval,
  }),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({
    customer: mockCustomer,
    loading: mockCustomerLoading,
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/components/ui/toast-notification', () => {
  const actual = jest.requireActual('@/components/ui/toast-notification');
  return {
    ...actual,
    notify: (...args: unknown[]) => notifyMock(...args),
  };
});

jest.mock('@/lib/client/checkout', () => ({
  checkoutApproval: jest.fn(),
}));

jest.mock('@/components/account/approvals/approval-summary', () => ({
  ApprovalSummary: () => <div>ApprovalSummary</div>,
}));

const mockProductListResolver = jest.fn((_props: unknown) => <div>ProductListResolver</div>);

jest.mock('@/components/product/product-list-resolver', () => ({
  ProductListResolver: (props: unknown) => mockProductListResolver(props),
}));

describe('ApprovalDetails', () => {
  beforeEach(() => {
    refreshApproval.mockReset();
    updateApprovalStatus.mockReset().mockResolvedValue(undefined);
    updateApproverComment.mockReset().mockResolvedValue(undefined);
    updateRequestorComment.mockReset().mockResolvedValue(undefined);
    notifyMock.mockReset();
    checkoutApprovalMock.mockReset().mockResolvedValue({ orderId: 'order-1' });
    mockProductListResolver.mockClear();
    mockApproval = { ...baseApproval };
    mockLoading = false;
    mockError = null;
    mockCustomer = { id: 'requestor-1' };
    mockCustomerLoading = false;
  });

  it('links quote resource IDs to the quote details page and formats dates with the active locale', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByRole('link', { name: 'Q-1000' })).toHaveAttribute('href', '/account/quotes/Q-1000');
    expect(screen.getAllByText(/Juni 2026|06\.2026/)).not.toHaveLength(0);
  });

  it('forwards resource items to ProductListResolver with the canonical grid config and locale, while preserving the fetching contract', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(mockProductListResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'de-DE',
        showGrossUnderNet: true,
        presentationConfig: expect.objectContaining({
          labels: expect.objectContaining({
            product: 'product',
            quantity: 'quantity',
            unitPrice: 'unitPrice',
            baseNetUnitPrice: 'baseNetUnitPrice',
            discount: 'discount',
          }),
          showGrossSecondary: true,
          showDiscountColumns: false,
        }),
        items: [
          expect.objectContaining({
            productId: 'product-1',
            quantity: 3,
            unitPrice: 10,
            currency: 'EUR',
            netUnitPrice: 10,
            grossUnitPrice: undefined,
          }),
        ],
      }),
    );
  });

  it('renders the page heading as "Approval: <id>" and a separate semantic Approval Details card heading', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByRole('heading', { level: 3, name: `approval: ${baseApproval.id}` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'approvalDetails' })).toBeInTheDocument();
  });

  it('labels the amount field as "totalNetAmount" while preserving the model-backed amount', () => {
    mockApproval = {
      ...baseApproval,
      resource: {
        ...baseApproval.resource,
        subtotalAggregate: { currency: 'EUR', netValue: 42, grossValue: 50, taxValue: 8 },
      },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText('totalNetAmount')).toBeInTheDocument();
    expect(screen.getByText(/42,00.*€/)).toBeInTheDocument();
    expect(screen.queryByText('totalAmount')).not.toBeInTheDocument();
  });

  it('falls back to a locale/currency-formatted amount when formattedAmount is absent', () => {
    mockApproval = {
      ...baseApproval,
      resource: {
        ...baseApproval.resource,
        subtotalAggregate: { currency: 'EUR', netValue: 42, grossValue: 50, taxValue: 8 },
      },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText(/42,00.*€/)).toBeInTheDocument();
  });

  it('preserves a numeric total amount of 0 when formattedAmount is absent, rather than falling back to "-"', () => {
    mockApproval = {
      ...baseApproval,
      resource: {
        ...baseApproval.resource,
        subtotalAggregate: { currency: 'EUR', netValue: 0, grossValue: 0, taxValue: 0 },
      },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText(/0,00.*€/)).toBeInTheDocument();
  });

  it('shows Total net amount from subtotalAggregate.netValue, not totalPrice.amount (finding 26: 37+23.05→60.05)', () => {
    // Characterization: product nets 37 + 23.05 = 60.05; totalPrice.amount 63.05 is VAT-inclusive and wrong for net.
    mockApproval = {
      ...baseApproval,
      resource: {
        ...baseApproval.resource,
        items: [
          { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
          { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
        ],
        totalPrice: { currency: 'EUR', amount: 63.05, formattedAmount: '€63.05' },
        subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
      },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText('totalNetAmount')).toBeInTheDocument();
    expect(screen.getByText(/60,05.*€/)).toBeInTheDocument();
    expect(screen.queryByText(/63,05.*€/)).not.toBeInTheDocument();
  });

  it.each(['CART', 'QUOTE'] as const)(
    'shows Total net amount as goods net plus shipping on the header (%s: 60.05 + 11 → 71.05)',
    (resourceType) => {
      mockApproval = {
        ...baseApproval,
        resourceType,
        resource: {
          ...baseApproval.resource,
          items: [
            { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
            { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
          ],
          totalPrice: { currency: 'EUR', amount: 63.05, formattedAmount: '€63.05' },
          subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
        },
        details: {
          currency: 'EUR',
          shipping: {
            methodId: 'standard',
            zoneId: 'zone-1',
            methodName: 'Standard',
            amount: 11,
          },
        },
      };

      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      expect(screen.getByText('totalNetAmount')).toBeInTheDocument();
      expect(screen.getByText(/71,05.*€/)).toBeInTheDocument();
      expect(screen.queryByText(/63,05.*€/)).not.toBeInTheDocument();
    },
  );

  it('falls back to the resource id as the related order when the resource has no order id (CART approval)', () => {
    mockApproval = { ...baseApproval, resourceType: 'CART', resource: { id: 'cart-1' } };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const label = screen.getByText('relatedOrder');
    expect(label.nextElementSibling).toHaveTextContent('cart-1');
    expect(screen.queryByText('relatedQuote')).not.toBeInTheDocument();
  });

  it('renders the source-backed related order id when present on the resource (CART approval)', () => {
    mockApproval = { ...baseApproval, resourceType: 'CART', resource: { id: 'cart-1', orderId: 'ORDER-5' } };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const label = screen.getByText('relatedOrder');
    expect(label.nextElementSibling).toHaveTextContent('ORDER-5');
  });

  it('labels the related resource as Related Quote for QUOTE approvals', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText('relatedQuote')).toBeInTheDocument();
    expect(screen.queryByText('relatedOrder')).not.toBeInTheDocument();
  });

  it('stacks full-width actions on mobile and keeps one horizontal row from sm (Figma 11895:141280 / 11895:138491)', () => {
    mockCustomer = { id: 'approver-1' };
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByTestId('approval-detail-header')).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'sm:flex-wrap');
    expect(screen.getByTestId('approval-detail-actions')).toHaveClass(
      'flex',
      'w-full',
      'shrink-0',
      'flex-col',
      'gap-4',
      'sm:w-auto',
      'sm:flex-row',
      'sm:flex-nowrap',
      'sm:items-center',
      'sm:justify-end',
    );
    expect(screen.getByRole('button', { name: /decline/ })).toHaveClass('w-full', 'sm:w-auto');
    expect(screen.getByRole('button', { name: /approve/ })).toHaveClass('w-full', 'sm:w-auto');
    expect(screen.getByRole('button', { name: /addComment/ })).toHaveClass('w-full', 'sm:w-auto');
  });

  it('omits the Status column from Approval History', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const history = screen.getByTestId('approval-history');
    expect(history).toHaveTextContent('date');
    expect(history).toHaveTextContent('event');
    expect(history).toHaveTextContent('changedBy');
    expect(history).toHaveTextContent('comment');
    expect(history).toHaveTextContent('changeReason');
    // Status appears in the page header badge, but not as a history column label
    const historyHeader = history.querySelector('.border-b');
    expect(historyHeader).not.toHaveTextContent('status');
  });

  it('scrolls Approval History horizontally when the table is wider than the container', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const history = screen.getByTestId('approval-history');
    const scroll = screen.getByTestId('approval-history-table-scroll');

    expect(history).toHaveClass('min-w-0');
    expect(scroll).toHaveClass('min-w-0', 'overflow-x-auto');
    expect(scroll.firstElementChild).toHaveClass('sm:min-w-[940px]');
  });

  it('shows approverComment as a separate top history row (finding 25)', () => {
    mockApproval = {
      ...baseApproval,
      comment: 'plz pprove',
      approverComment: 'i am admin and i commented',
      approver: {
        userId: 'approver-1',
        firstName: 'Pawel',
        lastName: 'Admin',
      },
    };
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const history = screen.getByTestId('approval-history');
    const approverRow = within(history).getByTestId('approval-history-approver-comment');
    const requestRow = within(history).getByTestId('approval-history-request');

    expect(approverRow).toHaveTextContent('approverComment');
    expect(approverRow).toHaveTextContent('Pawel Admin (roleApprover)');
    expect(approverRow).toHaveTextContent('i am admin and i commented');
    expect(approverRow).toHaveTextContent('-'); // no date
    expect(approverRow).not.toHaveTextContent('plz pprove');

    expect(requestRow).toHaveTextContent('approvalRequestCreated');
    expect(requestRow).toHaveTextContent('Requester One (roleCustomer)');
    expect(requestRow).toHaveTextContent('plz pprove');
    expect(requestRow).not.toHaveTextContent('i am admin and i commented');

    // Approver row is above requestor history row
    expect(approverRow.compareDocumentPosition(requestRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the approver history row when approverComment is missing (finding 25)', () => {
    mockApproval = {
      ...baseApproval,
      comment: 'request comment',
      approverComment: undefined,
    };
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const history = screen.getByTestId('approval-history');
    expect(within(history).queryByTestId('approval-history-approver-comment')).not.toBeInTheDocument();
    expect(within(history).getByTestId('approval-history-request')).toHaveTextContent('request comment');
  });

  describe('reload/loading boundary', () => {
    it('keeps SSR-backed approval content visible while only customer data is loading', () => {
      mockCustomerLoading = true;
      mockLoading = false;

      render(<ApprovalDetails approvalId="approval-requestor-1" initialApproval={baseApproval} />);

      expect(screen.getByRole('heading', { level: 4, name: 'approvalDetails' })).toBeInTheDocument();
      expect(screen.queryByText('loading')).not.toBeInTheDocument();
    });

    it('shows the loading state when the approval itself has not loaded yet', () => {
      mockApproval = null;
      mockLoading = true;
      mockCustomerLoading = false;

      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      expect(screen.getAllByText('loading').length).toBeGreaterThan(0);
      expect(screen.queryByRole('heading', { level: 4, name: 'approvalDetails' })).not.toBeInTheDocument();
    });

    it('shows the loading state during a mutation/refetch even when approval data is present', () => {
      mockLoading = true;

      render(<ApprovalDetails approvalId="approval-requestor-1" initialApproval={baseApproval} />);

      expect(screen.getAllByText('loading').length).toBeGreaterThan(0);
    });
  });

  describe('comment form', () => {
    it('opens the comment form between Approval Details and Approval History, and focuses its textarea', async () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /addComment/ }));

      const detailsHeading = screen.getByRole('heading', { level: 4, name: 'approvalDetails' });
      const commentHeading = screen.getByRole('heading', { level: 4, name: 'addComment' });
      const historyHeading = screen.getByRole('heading', { level: 4, name: 'approvalHistory' });

      expect(detailsHeading.compareDocumentPosition(commentHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(commentHeading.compareDocumentPosition(historyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('enterComment')).toHaveFocus();
      });
    });

    it('discards and closes the comment form without saving', () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /addComment/ }));
      fireEvent.change(screen.getByPlaceholderText('enterComment'), { target: { value: 'draft comment' } });
      fireEvent.click(screen.getByRole('button', { name: 'back' }));

      expect(screen.queryByPlaceholderText('enterComment')).not.toBeInTheDocument();
      expect(updateRequestorComment).not.toHaveBeenCalled();
      expect(updateApproverComment).not.toHaveBeenCalled();
    });

    it('saves the comment through the requestor-specific mutation for the requestor role', async () => {
      mockCustomer = { id: 'requestor-1' };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /addComment/ }));
      fireEvent.change(screen.getByPlaceholderText('enterComment'), { target: { value: 'a new comment' } });
      fireEvent.click(screen.getByRole('button', { name: 'saveComment' }));

      await waitFor(() => expect(updateRequestorComment).toHaveBeenCalledWith('a new comment'));
      expect(updateApproverComment).not.toHaveBeenCalled();
      expect(screen.queryByPlaceholderText('enterComment')).not.toBeInTheDocument();
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'requestorCommentUpdated', type: 'success' }),
      );
      expect(screen.queryByText('requestorCommentUpdated')).not.toBeInTheDocument();
    });

    it('saves the comment through the approver-specific mutation for the designated approver role', async () => {
      mockCustomer = { id: 'approver-1' };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /addComment/ }));
      fireEvent.change(screen.getByPlaceholderText('enterComment'), { target: { value: 'approver note' } });
      fireEvent.click(screen.getByRole('button', { name: 'saveComment' }));

      await waitFor(() => expect(updateApproverComment).toHaveBeenCalledWith('approver note'));
      expect(updateRequestorComment).not.toHaveBeenCalled();
      expect(screen.queryByPlaceholderText('enterComment')).not.toBeInTheDocument();
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'approverCommentUpdated', type: 'success' }),
      );
      expect(screen.queryByText('approverCommentUpdated')).not.toBeInTheDocument();
    });

    it('hides the addComment control and blocks the comment mutation for a customer who is neither requestor nor designated approver', () => {
      mockCustomer = { id: 'unrelated-customer' };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      expect(screen.queryByRole('button', { name: /addComment/ })).not.toBeInTheDocument();
      expect(updateRequestorComment).not.toHaveBeenCalled();
      expect(updateApproverComment).not.toHaveBeenCalled();
    });
  });

  describe('decline confirmation', () => {
    beforeEach(() => {
      mockCustomer = { id: 'approver-1' };
    });

    it('opens a labelled decline confirmation dialog without declining immediately', () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /decline/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('declineApprovalTitle')).toBeInTheDocument();
      expect(screen.getByText('declineApprovalDescription')).toBeInTheDocument();
      expect(updateApprovalStatus).not.toHaveBeenCalled();
    });

    it('cancel closes the dialog and does not decline', () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /decline/ }));
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateApprovalStatus).not.toHaveBeenCalled();
    });

    it('confirm declines exactly once, closes the dialog, and shows the standard full-width success notification', async () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /decline/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'decline' }));

      await waitFor(() => expect(updateApprovalStatus).toHaveBeenCalledTimes(1));
      expect(updateApprovalStatus).toHaveBeenCalledWith('DECLINED');

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'approvalSuccessfullyDeclined', type: 'success' }),
      );
    });

    it('disables the confirm button and blocks duplicate confirmation while the decline mutation is pending', async () => {
      let resolveUpdate: () => void = () => {};
      updateApprovalStatus.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /decline/ }));
      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: 'decline' });

      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      expect(updateApprovalStatus).toHaveBeenCalledTimes(1);
      expect(confirmButton).toBeDisabled();

      await act(async () => {
        resolveUpdate();
      });
    });

    it('keeps the details screen mounted and surfaces the existing inline error on decline failure', async () => {
      updateApprovalStatus.mockRejectedValueOnce(new Error('network down'));

      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /decline/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'decline' }));

      await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument());
      expect(screen.getByRole('heading', { level: 4, name: 'approvalDetails' })).toBeInTheDocument();
      expect(notifyMock).not.toHaveBeenCalled();
    });
  });

  describe('approve confirmation', () => {
    beforeEach(() => {
      mockCustomer = { id: 'approver-1' };
    });

    it('opens a labelled approve confirmation dialog without approving immediately', () => {
      mockApproval = {
        ...baseApproval,
        resourceType: 'QUOTE',
        resource: {
          ...baseApproval.resource,
          subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
        },
      };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('approveApprovalTitle')).toBeInTheDocument();
      expect(screen.getByText('approveApprovalDescription')).toBeInTheDocument();
      expect(updateApprovalStatus).not.toHaveBeenCalled();
      expect(checkoutApprovalMock).not.toHaveBeenCalled();
    });

    it('cancel closes the dialog and does not approve', () => {
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateApprovalStatus).not.toHaveBeenCalled();
      expect(checkoutApprovalMock).not.toHaveBeenCalled();
    });

    it('QUOTE confirm approves via status update and does not call checkout', async () => {
      mockApproval = {
        ...baseApproval,
        resourceType: 'QUOTE',
        resource: {
          ...baseApproval.resource,
          subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
        },
        details: undefined,
      };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'approve' }));

      await waitFor(() => expect(updateApprovalStatus).toHaveBeenCalledTimes(1));
      expect(updateApprovalStatus).toHaveBeenCalledWith('APPROVED');
      expect(checkoutApprovalMock).not.toHaveBeenCalled();

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'approvalSuccessfullyApproved', type: 'success' }),
      );
    });

    it('QUOTE approve failure surfaces a clear inline error without calling checkout', async () => {
      mockApproval = { ...baseApproval, resourceType: 'QUOTE', details: undefined };
      updateApprovalStatus.mockRejectedValueOnce(new Error('QUOTE approve rejected by API'));

      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'approve' }));

      await waitFor(() => expect(screen.getByText('QUOTE approve rejected by API')).toBeInTheDocument());
      expect(checkoutApprovalMock).not.toHaveBeenCalled();
      expect(notifyMock).not.toHaveBeenCalled();
    });

    it('CART confirm runs checkout-after-approve and does not call updateApprovalStatus', async () => {
      mockApproval = {
        ...baseApproval,
        resourceType: 'CART',
        resource: { id: 'cart-1', orderId: 'ORDER-9' },
        details: {
          currency: 'EUR',
          addresses: [
            {
              contactName: 'Ship',
              street: 'A',
              streetNumber: '1',
              zipCode: '1',
              city: 'C',
              country: 'DE',
              type: 'SHIPPING',
            },
            {
              contactName: 'Bill',
              street: 'B',
              streetNumber: '2',
              zipCode: '2',
              city: 'C',
              country: 'DE',
              type: 'BILLING',
            },
          ],
          shipping: {
            methodId: 'standard',
            zoneId: 'zone-1',
            methodName: 'Standard',
            amount: 5,
          },
          paymentMethods: [{ id: 'pm-1', code: 'invoice', active: true, provider: 'invoice', method: 'invoice' }],
        },
      };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'approve' }));

      await waitFor(() => expect(checkoutApprovalMock).toHaveBeenCalledTimes(1));
      expect(updateApprovalStatus).not.toHaveBeenCalled();
    });

    it('disables the confirm button and blocks duplicate confirmation while the approve mutation is pending', async () => {
      let resolveUpdate: () => void = () => {};
      updateApprovalStatus.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      mockApproval = { ...baseApproval, resourceType: 'QUOTE' };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /approve/ }));
      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: 'approve' });

      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      expect(updateApprovalStatus).toHaveBeenCalledTimes(1);
      expect(confirmButton).toBeDisabled();

      await act(async () => {
        resolveUpdate();
      });
    });
  });
});
