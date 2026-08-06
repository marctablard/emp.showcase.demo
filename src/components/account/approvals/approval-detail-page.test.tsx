/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const getApprovalById = jest.fn();
const mockGetTranslations = jest.fn(
  async ({ namespace }: { namespace: string }) =>
    (key: string) =>
      `${namespace}.${key}`,
);
const notFound = jest.fn(() => {
  throw new Error('NOT_FOUND');
});

jest.mock('next-intl/server', () => ({
  getTranslations: (params: { namespace: string }) => mockGetTranslations(params),
}));

jest.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

jest.mock('@/components/account/account-layout', () => ({
  __esModule: true,
  default: ({
    children,
    breadcrumbs,
  }: {
    children: React.ReactNode;
    breadcrumbs?: { href: string; label: string }[];
  }) => (
    <div data-testid="account-layout">
      <nav data-testid="breadcrumbs">
        {breadcrumbs?.map((crumb) => (
          <span key={crumb.href} data-testid="breadcrumb-item">
            {crumb.label}
          </span>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

jest.mock('@/components/account/approvals/approval-details', () => ({
  ApprovalDetails: ({ approvalId }: { approvalId: string }) => <div data-testid="approval-details">{approvalId}</div>,
}));

jest.mock('@/lib/ssr/approvals', () => ({
  getApprovalById: (...args: unknown[]) => getApprovalById(...args),
}));

jest.mock('@/lib/ssr/seo', () => ({
  getPageTitle: jest.fn(),
}));

const {
  default: ApprovalDetailPage,
} = require('@/app/[site]/[locale]/(nav-shell)/(default)/account/approvals/[id]/page');

describe('Approval detail page', () => {
  beforeEach(() => {
    getApprovalById.mockReset();
    mockGetTranslations.mockReset();
    mockGetTranslations.mockImplementation(
      async ({ namespace }: { namespace: string }) =>
        (key: string) =>
          `${namespace}.${key}`,
    );
    notFound.mockClear();
  });

  it('renders approval details for QUOTE approvals instead of redirecting to the quote', async () => {
    getApprovalById.mockResolvedValue({
      id: 'approval-quote-1',
      resourceType: 'QUOTE',
      resource: { id: 'quote-1' },
      approver: { userId: 'approver-1' },
      requestor: { userId: 'requestor-1' },
    });

    const element = await ApprovalDetailPage({
      params: Promise.resolve({ locale: 'en', site: 'main', id: 'approval-quote-1' }),
    });

    render(element);
    expect(screen.getByTestId('approval-details')).toHaveTextContent('approval-quote-1');
  });

  it('uses Account Details as the first breadcrumb label', async () => {
    getApprovalById.mockResolvedValue({
      id: 'approval-cart-1',
      resourceType: 'CART',
      resource: { id: 'cart-1' },
      approver: { userId: 'approver-1' },
      requestor: { userId: 'requestor-1' },
    });

    const element = await ApprovalDetailPage({
      params: Promise.resolve({ locale: 'en', site: 'main', id: 'approval-cart-1' }),
    });

    render(element);

    const crumbs = screen.getAllByTestId('breadcrumb-item');
    expect(crumbs[0]).toHaveTextContent('account.accountDetails');
    expect(crumbs[0]).not.toHaveTextContent('account.title');
  });
});
