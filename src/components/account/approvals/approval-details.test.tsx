/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Approval } from '@/platform/services/model/approval';
import { ApprovalDetails } from './approval-details';

const refreshApproval = jest.fn();

const mockApproval: Approval = {
  id: 'approval-requestor-1',
  status: 'PENDING',
  resourceType: 'QUOTE',
  action: 'CHECKOUT',
  resource: { id: 'Q-1000' },
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
    loading: false,
    error: null,
    updateApprovalStatus: jest.fn(),
    updateApproverComment: jest.fn(),
    updateRequestorComment: jest.fn(),
    refreshApproval,
  }),
}));

jest.mock('@/hooks/customer/useCustomer', () => ({
  __esModule: true,
  default: () => ({
    customer: {
      id: 'requestor-1',
    },
    loading: false,
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/client/checkout', () => ({
  checkoutApproval: jest.fn(),
}));

jest.mock('@/components/account/approvals/approval-summary', () => ({
  ApprovalSummary: () => <div>ApprovalSummary</div>,
}));

jest.mock('@/components/product/product-list-resolver', () => ({
  ProductListResolver: () => <div>ProductListResolver</div>,
}));

describe('ApprovalDetails', () => {
  beforeEach(() => {
    refreshApproval.mockReset();
  });

  it('links quote resource IDs to the quote details page and formats dates with the active locale', () => {
    render(<ApprovalDetails approvalId="approval-requestor-1" />);

    expect(screen.getByRole('link', { name: 'Q-1000' })).toHaveAttribute('href', '/account/quotes/Q-1000');
    expect(screen.getAllByText(/Juni 2026|06\.2026/)).not.toHaveLength(0);
  });
});
