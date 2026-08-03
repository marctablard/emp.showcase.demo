/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const getApprovalById = jest.fn();
const getCurrentCustomer = jest.fn();
const mockGetTranslations = jest.fn(
  async ({ namespace }: { namespace: string }) =>
    (key: string) =>
      `${namespace}.${key}`,
);
const redirect = jest.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});
const notFound = jest.fn(() => {
  throw new Error('NOT_FOUND');
});

jest.mock('next-intl/server', () => ({
  getTranslations: (params: { namespace: string }) => mockGetTranslations(params),
}));

jest.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    getPathname: ({ href }: { href: string }) => href,
  }),
}));

jest.mock('@/i18n/routing', () => ({
  routing: {},
}));

jest.mock('@/site/routing', () => ({
  routing: {},
}));

jest.mock('@/site/utils', () => ({
  addPrefixIfNeeded: (path: string, site: string) => `/${site}${path}`,
}));

jest.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: (href: string) => redirect(href),
}));

jest.mock('@/components/account/account-layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="account-layout">{children}</div>,
}));

jest.mock('@/components/account/approvals/approval-details', () => ({
  ApprovalDetails: ({ approvalId }: { approvalId: string }) => <div data-testid="approval-details">{approvalId}</div>,
}));

jest.mock('@/lib/ssr/approvals', () => ({
  getApprovalById: (...args: unknown[]) => getApprovalById(...args),
}));

jest.mock('@/lib/ssr/customer', () => ({
  getCurrentCustomer: (...args: unknown[]) => getCurrentCustomer(...args),
}));

jest.mock('@/lib/ssr/seo', () => ({
  getPageTitle: jest.fn(),
}));

const {
  default: ApprovalDetailPage,
} = require('@/app/[site]/[locale]/(nav-shell)/(default)/account/approvals/[id]/page');

describe('Approval requester detail page', () => {
  beforeEach(() => {
    getApprovalById.mockReset();
    getCurrentCustomer.mockReset();
    mockGetTranslations.mockReset();
    mockGetTranslations.mockImplementation(
      async ({ namespace }: { namespace: string }) =>
        (key: string) =>
          `${namespace}.${key}`,
    );
    redirect.mockClear();
    notFound.mockClear();
  });

  it('redirects QUOTE approvals to the linked quote details page for the quote owner', async () => {
    getCurrentCustomer.mockResolvedValue({ id: 'requestor-1' });
    getApprovalById.mockResolvedValue({
      id: 'approval-quote-1',
      resourceType: 'QUOTE',
      resource: { id: 'quote-1' },
      approver: { userId: 'approver-1' },
      requestor: { userId: 'requestor-1' },
    });

    await expect(
      ApprovalDetailPage({ params: Promise.resolve({ locale: 'en', site: 'main', id: 'approval-quote-1' }) }),
    ).rejects.toThrow('REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/main/account/quotes/quote-1');
  });

  it('renders approval details for the designated approver of a QUOTE approval instead of redirecting to the quote', async () => {
    getCurrentCustomer.mockResolvedValue({ id: 'approver-1' });
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

    expect(redirect).not.toHaveBeenCalled();
    render(element);
    expect(screen.getByTestId('approval-details')).toHaveTextContent('approval-quote-1');
  });
});
