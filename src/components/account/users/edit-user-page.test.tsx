/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';

const getCompanyUserById = jest.fn();
const getHeaderCompanies = jest.fn();
const mockGetTranslations = jest.fn(
  async ({ namespace }: { namespace: string }) =>
    (key: string, values?: { name?: string }) => {
      if (key === 'breadcrumbEditUser') {
        return `Edit ${values?.name ?? ''}`;
      }
      return `${namespace}.${key}`;
    },
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
  UserDetailsForm: ({
    initialUser,
    headerCompanies,
  }: {
    initialUser?: CompanyUser;
    headerCompanies?: { id: string; name: string }[];
  }) => (
    <div data-testid="user-details-form">
      {initialUser?.id}
      <span data-testid="header-companies">{JSON.stringify(headerCompanies)}</span>
    </div>
  ),
}));

jest.mock('@/lib/ssr/user-management', () => ({
  requireB2bAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
  getCompanyUserById: (...args: unknown[]) => getCompanyUserById(...args),
  getHeaderCompanies: (...args: unknown[]) => getHeaderCompanies(...args),
}));

jest.mock('@/lib/ssr/seo', () => ({
  getPageTitle: jest.fn(),
}));

const { default: EditUserPage } = require('@/app/[site]/[locale]/(nav-shell)/(default)/account/users/[id]/page');

function buildUser(overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Doe',
    contactEmail: 'jane.doe@mail.com',
    active: true,
    createdAt: '2024-12-17T10:00:00.000Z',
    groups: [{ id: 'g-1', legalEntityId: 'le-1', displayName: 'Admin' }],
    ...overrides,
  };
}

function mockTranslations() {
  mockGetTranslations.mockImplementation(
    async ({ namespace }: { namespace: string }) =>
      (key: string, values?: { name?: string }) => {
        if (key === 'breadcrumbEditUser') {
          return `Edit ${values?.name ?? ''}`;
        }
        return `${namespace}.${key}`;
      },
  );
}

describe('Edit user page', () => {
  beforeEach(() => {
    getCompanyUserById.mockReset();
    getHeaderCompanies.mockReset();
    getHeaderCompanies.mockResolvedValue([]);
    mockGetTranslations.mockReset();
    mockTranslations();
    notFound.mockClear();
  });

  it('appends an interpolated edit crumb after a User Management list link', async () => {
    getCompanyUserById.mockResolvedValue(buildUser());

    const element = await EditUserPage({
      params: Promise.resolve({ locale: 'en', id: 'user-1' }),
    });

    render(element);

    const crumbs = screen.getAllByTestId('breadcrumb-item');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toHaveTextContent('account.accountDetails');
    expect(crumbs[1]).toHaveTextContent('user-management.heading');
    expect(crumbs[1]).toHaveAttribute('data-href', '/account/users');
    expect(crumbs[2]).toHaveTextContent('Edit Jane Doe');
    expect(crumbs[2]).toHaveAttribute('data-href', '/account/users/user-1');
  });

  it('trims first and last name and collapses extra whitespace in the current crumb', async () => {
    getCompanyUserById.mockResolvedValue(
      buildUser({
        firstName: '  Jane  ',
        lastName: '  ',
      }),
    );

    const element = await EditUserPage({
      params: Promise.resolve({ locale: 'en', id: 'user-1' }),
    });

    render(element);

    const crumbs = screen.getAllByTestId('breadcrumb-item');
    expect(crumbs[2]).toHaveTextContent('Edit Jane');
    expect(crumbs[2].textContent).not.toMatch(/Edit $/);
  });

  it('falls back to the user id when first and last name are empty', async () => {
    getCompanyUserById.mockResolvedValue(
      buildUser({
        id: 'C123',
        firstName: '   ',
        lastName: '',
      }),
    );

    const element = await EditUserPage({
      params: Promise.resolve({ locale: 'en', site: 'main', id: 'C123' }),
    });

    render(element);

    const crumbs = screen.getAllByTestId('breadcrumb-item');
    expect(crumbs[1]).toHaveAttribute('data-href', '/account/users');
    expect(crumbs[2]).toHaveTextContent('Edit C123');
    expect(crumbs[2]).toHaveAttribute('data-href', '/account/users/C123');
  });

  it('passes headerCompanies from SSR into UserDetailsForm', async () => {
    const headerCompanies = [
      { id: 'le-1', name: 'NovaTech' },
      { id: 'le-2', name: 'Emporix GmbH' },
    ];
    getCompanyUserById.mockResolvedValue(buildUser());
    getHeaderCompanies.mockResolvedValue(headerCompanies);

    const element = await EditUserPage({
      params: Promise.resolve({ locale: 'en', id: 'user-1' }),
    });

    render(element);

    expect(getHeaderCompanies).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user-details-form')).toHaveTextContent('user-1');
    expect(screen.getByTestId('header-companies')).toHaveTextContent(JSON.stringify(headerCompanies));
  });
});
