/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalDetails } from './approval-details';

const refreshApproval = jest.fn();
const updateApprovalStatus = jest.fn();
const updateApproverComment = jest.fn();
const updateRequestorComment = jest.fn();
const notifyMock = jest.fn();

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

const mockProductListResolver = jest.fn(() => <div>ProductListResolver</div>);

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

  it('forwards resource items to ProductListResolver with a net-first resolver input and no derived gross price, preserving the fetching contract', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(mockProductListResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        showGrossUnderNet: true,
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
      resource: { ...baseApproval.resource, totalPrice: { currency: 'EUR', amount: 42, formattedAmount: '€42.00' } },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText('totalNetAmount')).toBeInTheDocument();
    expect(screen.getByText('€42.00')).toBeInTheDocument();
    expect(screen.queryByText('totalAmount')).not.toBeInTheDocument();
  });

  it('falls back to a locale/currency-formatted amount when formattedAmount is absent', () => {
    mockApproval = {
      ...baseApproval,
      resource: { ...baseApproval.resource, totalPrice: { currency: 'EUR', amount: 42 } },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText(/42,00.*€/)).toBeInTheDocument();
  });

  it('preserves a numeric total amount of 0 when formattedAmount is absent, rather than falling back to "-"', () => {
    mockApproval = {
      ...baseApproval,
      resource: { ...baseApproval.resource, totalPrice: { currency: 'EUR', amount: 0 } },
    };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByText(/0,00.*€/)).toBeInTheDocument();
  });

  it('falls back to the resource id as the related order when the resource has no order id (CART approval)', () => {
    mockApproval = { ...baseApproval, resourceType: 'CART', resource: { id: 'cart-1' } };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const label = screen.getByText('relatedOrder');
    expect(label.nextElementSibling).toHaveTextContent('cart-1');
  });

  it('renders the source-backed related order id when present on the resource (CART approval)', () => {
    mockApproval = { ...baseApproval, resourceType: 'CART', resource: { id: 'cart-1', orderId: 'ORDER-5' } };

    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    const label = screen.getByText('relatedOrder');
    expect(label.nextElementSibling).toHaveTextContent('ORDER-5');
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
    });

    it('saves the comment through the approver-specific mutation for the designated approver role', async () => {
      mockCustomer = { id: 'approver-1' };
      render(<ApprovalDetails approvalId="approval-requestor-1" />);

      fireEvent.click(screen.getByRole('button', { name: /addComment/ }));
      fireEvent.change(screen.getByPlaceholderText('enterComment'), { target: { value: 'approver note' } });
      fireEvent.click(screen.getByRole('button', { name: 'saveComment' }));

      await waitFor(() => expect(updateApproverComment).toHaveBeenCalledWith('approver note'));
      expect(updateRequestorComment).not.toHaveBeenCalled();
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
});
