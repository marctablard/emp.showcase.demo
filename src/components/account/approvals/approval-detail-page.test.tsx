/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';

const getApprovalById = jest.fn();
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
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
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

jest.mock('@/lib/ssr/seo', () => ({
  getPageTitle: jest.fn(),
}));

const {
  default: ApprovalDetailPage,
} = require('@/app/[site]/[locale]/(nav-shell)/(default)/account/approvals/[id]/page');

describe('Approval requester detail page', () => {
  beforeEach(() => {
    getApprovalById.mockReset();
    mockGetTranslations.mockClear();
    redirect.mockClear();
    notFound.mockClear();
  });

  it('redirects QUOTE approvals to the linked quote details page', async () => {
    getApprovalById.mockResolvedValue({
      id: 'approval-quote-1',
      resourceType: 'QUOTE',
      resource: { id: 'quote-1' },
    });

    await expect(
      ApprovalDetailPage({ params: Promise.resolve({ locale: 'en', site: 'main', id: 'approval-quote-1' }) }),
    ).rejects.toThrow('REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/main/account/quotes/quote-1');
  });
});
