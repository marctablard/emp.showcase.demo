/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const mockGetTranslations = jest.fn(
  async ({ namespace }: { namespace: string }) =>
    (key: string) =>
      `${namespace}.${key}`,
);

jest.mock('next-intl/server', () => ({
  getTranslations: (params: { namespace: string }) => mockGetTranslations(params),
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
          <span key={crumb.href} data-testid="breadcrumb-item" data-href={crumb.href}>
            {crumb.label}
          </span>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

jest.mock('@/components/account/users/user-details-form', () => ({
  UserDetailsForm: () => <div data-testid="user-details-form" />,
}));

jest.mock('@/lib/ssr/user-management', () => ({
  requireB2bAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
}));

jest.mock('@/lib/ssr/seo', () => ({
  getPageTitle: jest.fn(),
}));

const { default: NewUserPage } = require('@/app/[site]/[locale]/(nav-shell)/(default)/account/users/new/page');

describe('New user page', () => {
  beforeEach(() => {
    mockGetTranslations.mockReset();
    mockGetTranslations.mockImplementation(
      async ({ namespace }: { namespace: string }) =>
        (key: string) =>
          `${namespace}.${key}`,
    );
  });

  it('appends user creation as the current crumb after a User Management list link', async () => {
    const element = await NewUserPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    render(element);

    const crumbs = screen.getAllByTestId('breadcrumb-item');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toHaveTextContent('account.accountDetails');
    expect(crumbs[0]).toHaveAttribute('data-href', '/account');
    expect(crumbs[1]).toHaveTextContent('user-management.heading');
    expect(crumbs[1]).toHaveAttribute('data-href', '/account/users');
    expect(crumbs[2]).toHaveTextContent('user-management.breadcrumbUserCreation');
    expect(crumbs[2]).toHaveAttribute('data-href', '/account/users/new');
  });
});
