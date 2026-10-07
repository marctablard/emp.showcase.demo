/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ACCOUNT_DETAIL_LIST_PAGE_SIZE, USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import {
  UsersList,
  canManageSelectedCompanyUsers,
  canShowCompanyScopeToggle,
  deserializeShowOtherCompanyUsers,
  deserializeUsersListSort,
  showOtherCompanyUsersStorageKey,
  usersListSortStorageKey,
} from './users-list';

const persistOptionsLog: Array<{ enabled?: boolean; key: string; defaultValue: unknown }> = [];

jest.mock('@/hooks/common/usePersistedState', () => {
  const actual = jest.requireActual(
    '@/hooks/common/usePersistedState',
  ) as typeof import('@/hooks/common/usePersistedState');
  return {
    usePersistedState: (options: Parameters<typeof actual.usePersistedState>[0]) => {
      persistOptionsLog.push({
        enabled: options.enabled,
        key: options.key,
        defaultValue: options.defaultValue,
      });
      return actual.usePersistedState(options);
    },
  };
});

const mockUseSession = jest.fn();
jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      if (values && 'name' in values) {
        return `${key}:${values.name}`;
      }
      if (values) {
        return `${key}:${JSON.stringify(values)}`;
      }
      return key;
    };
    t.raw = (key: string) => key;
    return t;
  },
  useLocale: () => 'en-GB',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseCompanyUsers = jest.fn();
const mockUseOtherCompanyUsers = jest.fn();

jest.mock('@/hooks/user-management/useCompanyUsers', () => ({
  useCompanyUsers: (...args: unknown[]) => mockUseCompanyUsers(...args),
  useOtherCompanyUsers: (...args: unknown[]) => mockUseOtherCompanyUsers(...args),
}));

jest.mock('@/hooks/common/useGlobalCursor', () => ({
  useGlobalCursor: jest.fn(),
  acquireNavigationWaitCursorLease: jest.fn(),
  releaseNavigationWaitCursorLease: jest.fn(),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Warning: 'warning', Success: 'success', Error: 'error', Info: 'info' },
  notify: jest.fn(),
}));

jest.mock('./delete-user-dialog', () => ({
  DeleteUserDialog: ({ open, user }: { open: boolean; user: CompanyUser | null }) =>
    open && user ? <div data-testid="delete-user-dialog">{user.id}</div> : null,
}));

jest.mock('@/components/ui/table-pagination', () => ({
  TablePagination: ({ currentPage, totalPages, onPreviousPage, onNextPage }: any) => (
    <div>
      {currentPage > 1 ? <button onClick={onPreviousPage}>previous</button> : null}
      {currentPage < totalPages ? <button onClick={onNextPage}>next</button> : null}
    </div>
  ),
}));

function buildUser(overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Smith',
    contactEmail: 'j.smith@mail.com',
    active: true,
    createdAt: '2024-12-17T10:00:00.000Z',
    groups: [{ id: 'g-1', legalEntityId: 'le-1', displayName: 'Admin' }],
    ...overrides,
  };
}

function mockUsersResult(overrides: {
  users: CompanyUser[];
  loading?: boolean;
  error?: Error | null;
  pagination?: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
  refreshUsers?: jest.Mock;
}) {
  mockUseCompanyUsers.mockReturnValue({
    users: overrides.users,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    pagination: overrides.pagination,
    refreshUsers: overrides.refreshUsers ?? jest.fn(),
  });
}

function mockOtherCompanyUsersResult(
  overrides: {
    users?: CompanyUser[];
    loading?: boolean;
    error?: Error | null;
    pagination?: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
    refreshUsers?: jest.Mock;
  } = {},
) {
  mockUseOtherCompanyUsers.mockReturnValue({
    users: overrides.users ?? [],
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    pagination: overrides.pagination,
    refreshUsers: overrides.refreshUsers ?? jest.fn(),
  });
}

const DEFAULT_OTHER_COMPANY_USERS_OPTIONS = {
  enabled: false,
  pageNumber: 1,
  pageSize: 10,
  sort: 'firstName:asc',
  query: undefined,
};

const AUTHENTICATED_CUSTOMER_ID = 'admin-customer-1';
const OTHER_ADMIN_CUSTOMER_ID = 'other-admin-2';

function authenticatedSession(customerId = AUTHENTICATED_CUSTOMER_ID, legalEntityId?: string) {
  return { session: { customerId, ...(legalEntityId ? { legalEntityId } : {}) } };
}

function getAllCompaniesOption() {
  return screen.getByRole('radio', { name: 'allCompanies' });
}

function getCurrentCompanyOption() {
  return screen.getByRole('radio', { name: 'currentCompany' });
}

describe('UsersList', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    persistOptionsLog.length = 0;
    mockUseSession.mockReturnValue(authenticatedSession());
    mockOtherCompanyUsersResult();
  });

  it('passes the canonical initial page-one default-sort request metadata to useCompanyUsers for SSR hydration reuse', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 },
    });

    render(<UsersList initialUsers={[buildUser()]} initialTotalCount={1} />);

    expect(mockUseCompanyUsers).toHaveBeenCalled();
    const [, options] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(options).toMatchObject({
      pageNumber: 1,
      pageSize: 10,
      sort: 'firstName:asc',
      initialTotalCount: 1,
      initialRequest: {
        pageNumber: 1,
        pageSize: 10,
        sort: 'firstName:asc',
        query: undefined,
      },
    });
  });

  it('renders the User Management heading and create CTA to /account/users/new', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} />);

    const heading = screen.getByRole('heading', { level: 1, name: 'heading' });
    expect(heading).toBeInTheDocument();
    const createCta = screen.getByRole('link', { name: /createButton/i });
    expect(createCta).toHaveAttribute('href', '/account/users/new');
  });

  it('does not submit search while typing; Enter sends the raw two-token term to the BFF', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'John S' } });

    const [, optionsBeforeEnter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsBeforeEnter.query).toBeUndefined();

    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const [, optionsAfterEnter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterEnter.query).toBe('John S');
    expect(optionsAfterEnter.pageNumber).toBe(1);
  });

  it('restores the unfiltered list when the search is cleared and Enter is pressed', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 2, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<UsersList initialUsers={[buildUser()]} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'John S' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const [, optionsAfterSearch] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterSearch.query).toBe('John S');
    expect(optionsAfterSearch.pageNumber).toBe(1);

    fireEvent.change(input, { target: { value: '' } });
    const [, optionsAfterClearBeforeEnter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterClearBeforeEnter.query).toBe('John S');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    const [, optionsAfterClearEnter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterClearEnter.query).toBeUndefined();
    expect(optionsAfterClearEnter.pageNumber).toBe(1);
  });

  it('wraps the search, table, and pagination in exactly one shared table-card surface', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    const { container } = render(<UsersList initialUsers={[buildUser()]} />);

    const surfaces = container.querySelectorAll('section.border-border-primary');
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toHaveClass('border', 'bg-surface-page');
    expect(surfaces[0].querySelector('table')).not.toBeNull();
    expect(container.querySelector('input[type="search"], input')).not.toBeNull();
  });

  it('renders the error state distinctly instead of the table when the fetch fails', () => {
    mockUsersResult({ users: [], error: new Error('boom') });
    render(<UsersList initialUsers={[]} />);

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a Try Again action in the error state that retries via refreshUsers', () => {
    const refreshUsers = jest.fn();
    mockUsersResult({ users: [], error: new Error('boom'), refreshUsers });
    render(<UsersList initialUsers={[]} />);

    fireEvent.click(screen.getByText('tryAgain'));
    expect(refreshUsers).toHaveBeenCalledTimes(1);
  });

  it('hides the company-scope toggle when showOtherCompaniesToggle is false', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} />);

    expect(screen.queryByRole('radiogroup', { name: 'companyScope' })).not.toBeInTheDocument();
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('shows the current-company / All companies toggle alongside CREATE NEW USER for multi-company admins', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle selectedCompanyName="NovaTech Nord" />);

    const scope = screen.getByRole('radiogroup', { name: 'companyScope' });
    const createCta = screen.getByRole('link', { name: /createButton/i });
    expect(scope).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'NovaTech Nord' })).toBeChecked();
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(createCta).toHaveAttribute('href', '/account/users/new');
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.queryByRole('columnheader', { name: 'columns.legalEntityName' })).not.toBeInTheDocument();
  });

  it('reuses the same table with a Legal Entity Name column and no delete when the checkbox is checked', () => {
    const firstUser = buildUser();
    const selectedLeRow = buildUser({
      legalEntityId: 'le-selected',
      legalEntityName: 'Selected Co',
    });
    const otherLeSameUser = buildUser({
      legalEntityId: 'le-other',
      legalEntityName: 'Other Co',
      contactEmail: 'j.smith.other@mail.com',
    });
    const otherUser = buildUser({
      id: 'other-1',
      firstName: 'Pat',
      lastName: 'Other',
      contactEmail: 'pat.other@mail.com',
      legalEntityId: 'le-other',
      legalEntityName: 'Other Co',
    });
    mockUsersResult({ users: [firstUser] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [selectedLeRow, otherLeSameUser, otherUser] : [],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 3 } : undefined,
      refreshUsers: jest.fn(),
    }));

    const { container } = render(
      <UsersList initialUsers={[firstUser]} showOtherCompaniesToggle onDeleteUser={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'deleteAriaLabel:John Smith' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'columns.legalEntityName' })).not.toBeInTheDocument();

    fireEvent.click(getAllCompaniesOption());

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(container.querySelectorAll('section.border-border-primary')).toHaveLength(1);
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });
    expect(getAllCompaniesOption()).toBeChecked();

    expect(screen.queryByRole('button', { name: 'deleteAriaLabel:John Smith' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'deleteAriaLabel:Pat Other' })).not.toBeInTheDocument();
    const johnEditLinks = screen.getAllByRole('link', { name: 'editAriaLabel:John Smith' });
    expect(johnEditLinks).toHaveLength(2);
    expect(johnEditLinks[0]).toHaveAttribute('href', '/account/users/user-1');
    expect(johnEditLinks[1]).toHaveAttribute('href', '/account/users/user-1');
    expect(screen.getByRole('link', { name: 'editAriaLabel:Pat Other' })).toHaveAttribute(
      'href',
      '/account/users/other-1',
    );
    expect(screen.getByRole('columnheader', { name: 'columns.legalEntityName' })).toBeInTheDocument();
    expect(screen.getByText('Selected Co')).toBeInTheDocument();
    expect(screen.getAllByText('Other Co')).toHaveLength(2);
    expect(screen.getByText('Pat')).toBeInTheDocument();
    expect(screen.getByText('j.smith.other@mail.com')).toBeInTheDocument();
  });

  it('restores the selected-LE table without a Legal Entity Name column when the checkbox is unchecked', () => {
    const otherUser = buildUser({
      id: 'other-1',
      firstName: 'Pat',
      lastName: 'Other',
      contactEmail: 'pat.other@mail.com',
      legalEntityId: 'le-other',
      legalEntityName: 'Other Co',
    });
    mockUsersResult({ users: [buildUser()] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [otherUser] : [],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 } : undefined,
      refreshUsers: jest.fn(),
    }));

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle onDeleteUser={jest.fn()} />);

    fireEvent.click(getAllCompaniesOption());
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('Pat')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'columns.legalEntityName' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'deleteAriaLabel:John Smith' })).not.toBeInTheDocument();

    fireEvent.click(getCurrentCompanyOption());
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(getCurrentCompanyOption()).toBeChecked();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.queryByText('Pat')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'columns.legalEntityName' })).not.toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'deleteAriaLabel:John Smith' })).toBeInTheDocument();
  });

  it('skips the selected-LE fetch and pages the combined set from useOtherCompanyUsers when checked', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 },
    });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [buildUser({ legalEntityId: 'le-other', legalEntityName: 'Other Co' })] : [],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 } : undefined,
      refreshUsers: jest.fn(),
    }));

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    const [, firstTableOptionsBefore] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(firstTableOptionsBefore).toMatchObject({
      pageNumber: 1,
      pageSize: 10,
      sort: 'firstName:asc',
      enabled: true,
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);

    fireEvent.click(getAllCompaniesOption());

    const [, firstTableOptionsAfter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(firstTableOptionsAfter).toMatchObject({
      pageNumber: 1,
      pageSize: 10,
      sort: 'firstName:asc',
      enabled: false,
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      enabled: true,
      pageNumber: 2,
      pageSize: 10,
      sort: 'firstName:asc',
      query: undefined,
    });
    expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
      enabled: false,
      pageNumber: 2,
    });
  });

  it('resets page to 1 when the other-companies checkbox turns on', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    mockOtherCompanyUsersResult({
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 4, totalItems: 20 },
    });

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
      pageNumber: 2,
      enabled: true,
    });

    fireEvent.click(getAllCompaniesOption());
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
      pageNumber: 1,
    });
    expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
      enabled: false,
      pageNumber: 1,
    });
  });

  it('applies Enter search and sortable headers to useOtherCompanyUsers when checked', () => {
    mockUsersResult({ users: [buildUser()] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [buildUser({ legalEntityId: 'le-other', legalEntityName: 'Other Co' })] : [],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 } : undefined,
      refreshUsers: jest.fn(),
    }));

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    fireEvent.click(getAllCompaniesOption());

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'John S' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      enabled: true,
      pageNumber: 1,
      pageSize: 10,
      sort: 'firstName:asc',
      query: 'John S',
    });

    fireEvent.click(screen.getByRole('button', { name: /columns.lastName/ }));
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      enabled: true,
      pageNumber: 1,
      pageSize: 10,
      sort: 'lastName:asc',
      query: 'John S',
    });
  });

  it('retries the combined-view fetch when the other-companies hook errors', () => {
    const refreshOtherCompanyUsers = jest.fn();
    mockUsersResult({ users: [buildUser()] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: [],
      loading: false,
      error: options?.enabled ? new Error('other boom') : null,
      pagination: undefined,
      refreshUsers: refreshOtherCompanyUsers,
    }));

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    fireEvent.click(getAllCompaniesOption());

    expect(screen.getByText('other boom')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('tryAgain'));
    expect(refreshOtherCompanyUsers).toHaveBeenCalledTimes(1);
  });

  it('remounts the same customerId with stored true and enables useOtherCompanyUsers after persist becomes enabled', async () => {
    const storageKey = showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID);
    localStorage.setItem(storageKey, 'true');
    mockUsersResult({ users: [buildUser()] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [buildUser({ legalEntityId: 'le-other', legalEntityName: 'Other Co' })] : [buildUser()],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 } : undefined,
      refreshUsers: jest.fn(),
    }));

    const { unmount } = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(getAllCompaniesOption()).toBeChecked();
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });

    unmount();
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(getAllCompaniesOption()).toBeChecked();
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });
    expect(localStorage.getItem(storageKey)).toBe('true');
  });

  it('remounts stored false and stays unchecked after the user unchecks', async () => {
    const storageKey = showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID);
    mockUsersResult({ users: [buildUser()] });

    const { unmount } = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    fireEvent.click(getAllCompaniesOption());
    expect(getAllCompaniesOption()).toBeChecked();
    fireEvent.click(getCurrentCompanyOption());
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(getCurrentCompanyOption()).toBeChecked();
    expect(localStorage.getItem(storageKey)).toBe('false');

    unmount();
    localStorage.setItem(storageKey, 'false');
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(getAllCompaniesOption()).not.toBeChecked();
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
    expect(localStorage.getItem(storageKey)).toBe('false');
  });

  it('does not inherit another admin’s stored true for a different customerId', async () => {
    localStorage.setItem(showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID), 'true');
    mockUseSession.mockReturnValue(authenticatedSession(OTHER_ADMIN_CUSTOMER_ID));
    mockUsersResult({ users: [buildUser()] });

    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(persistOptionsLog).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            enabled: true,
            key: showOtherCompanyUsersStorageKey(OTHER_ADMIN_CUSTOMER_ID),
          }),
        ]),
      );
    });
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('leaves the checkbox unchecked for invalid JSON, a missing key, or missing/ANONYMOUS userId and does not write without a userId', () => {
    const storageKey = showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID);
    mockUsersResult({ users: [buildUser()] });

    localStorage.setItem(storageKey, '{not-json');
    const invalidJson = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(getAllCompaniesOption()).not.toBeChecked();
    invalidJson.unmount();
    localStorage.clear();

    const missingKey = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(getAllCompaniesOption()).not.toBeChecked();
    missingKey.unmount();

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    mockUseSession.mockReturnValue({ session: {} });
    const missingUserId = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(setItemSpy.mock.calls.filter(([key]) => String(key).startsWith('user-management.v1:'))).toHaveLength(0);
    missingUserId.unmount();
    setItemSpy.mockRestore();

    localStorage.setItem(showOtherCompanyUsersStorageKey(CUSTOMER_ID.SESSION_ANONYMOUS), 'true');
    mockUseSession.mockReturnValue({ session: { customerId: CUSTOMER_ID.SESSION_ANONYMOUS } });
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('rehydrates stored true when persist becomes enabled without rewriting it to false', async () => {
    const storageKey = showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID);
    localStorage.setItem(storageKey, 'true');
    mockUsersResult({ users: [buildUser()] });
    mockUseOtherCompanyUsers.mockImplementation((options?: { enabled?: boolean }) => ({
      users: options?.enabled ? [buildUser({ legalEntityId: 'le-other', legalEntityName: 'Other Co' })] : [buildUser()],
      loading: false,
      error: null,
      pagination: options?.enabled ? { pageNumber: 1, pageSize: 5, totalPages: 1, totalItems: 1 } : undefined,
      refreshUsers: jest.fn(),
    }));

    const firstRender = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(persistOptionsLog[0]).toEqual(
      expect.objectContaining({
        enabled: false,
        defaultValue: false,
        key: storageKey,
      }),
    );
    await waitFor(() => {
      expect(getAllCompaniesOption()).toBeChecked();
    });
    expect(persistOptionsLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          key: storageKey,
        }),
      ]),
    );
    expect(localStorage.getItem(storageKey)).toBe('true');
    firstRender.unmount();

    persistOptionsLog.length = 0;
    localStorage.setItem(storageKey, 'true');
    mockUseSession.mockReturnValue({ session: {} });
    const { rerender } = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(getAllCompaniesOption()).not.toBeChecked();
    expect(localStorage.getItem(storageKey)).toBe('true');
    expect(persistOptionsLog).toEqual(expect.arrayContaining([expect.objectContaining({ enabled: false })]));
    expect(persistOptionsLog).not.toEqual(expect.arrayContaining([expect.objectContaining({ enabled: true })]));

    mockUseSession.mockReturnValue(authenticatedSession());
    rerender(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    await waitFor(() => {
      expect(getAllCompaniesOption()).toBeChecked();
    });
    expect(persistOptionsLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          key: storageKey,
        }),
      ]),
    );
    expect(localStorage.getItem(storageKey)).toBe('true');
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });
  });

  it('uses ACCOUNT_DETAIL_LIST_PAGE_SIZE 10 for the list page size', () => {
    expect(ACCOUNT_DETAIL_LIST_PAGE_SIZE).toBe(10);
    expect(USERS_PER_PAGE).toBe(10);
    expect(USERS_PER_PAGE).toBe(ACCOUNT_DETAIL_LIST_PAGE_SIZE);
  });

  it('submits search on blur with the trimmed query and resets to page 1', () => {
    mockUsersResult({
      users: [buildUser()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<UsersList initialUsers={[buildUser()]} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: '  Jane  ' } });
    fireEvent.blur(input);

    const [, optionsAfterBlur] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterBlur.query).toBe('Jane');
    expect(optionsAfterBlur.pageNumber).toBe(1);

    fireEvent.change(input, { target: { value: 'Ada' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    const [, optionsAfterEnter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(optionsAfterEnter.query).toBe('Ada');
    expect(optionsAfterEnter.pageNumber).toBe(1);
  });

  it('deserializes invalid localStorage JSON as unchecked without throwing', () => {
    expect(deserializeShowOtherCompanyUsers('{not-json')).toBe(false);
    expect(deserializeShowOtherCompanyUsers('true')).toBe(true);
    expect(deserializeShowOtherCompanyUsers('false')).toBe(false);
  });

  it('deserializes stored sort and falls back to firstName:asc when invalid', () => {
    expect(deserializeUsersListSort(JSON.stringify({ field: 'lastName', direction: 'desc' }))).toEqual({
      field: 'lastName',
      direction: 'desc',
    });
    expect(deserializeUsersListSort('{not-json')).toEqual({ field: 'firstName', direction: 'asc' });
    expect(deserializeUsersListSort(JSON.stringify({ field: 'userGroup', direction: 'asc' }))).toEqual({
      field: 'firstName',
      direction: 'asc',
    });
    expect(deserializeUsersListSort(JSON.stringify({ field: 'lastName', direction: 'up' }))).toEqual({
      field: 'firstName',
      direction: 'asc',
    });
  });

  it('writes sort to sessionStorage and restores it after remount', async () => {
    const storageKey = usersListSortStorageKey(AUTHENTICATED_CUSTOMER_ID);
    mockUsersResult({ users: [buildUser()] });

    const { unmount } = render(<UsersList initialUsers={[buildUser()]} />);
    fireEvent.click(screen.getByRole('button', { name: /columns.lastName/ }));

    await waitFor(() => {
      expect(sessionStorage.getItem(storageKey)).toBe(JSON.stringify({ field: 'lastName', direction: 'asc' }));
    });
    expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
      sort: 'lastName:asc',
    });

    unmount();
    render(<UsersList initialUsers={[buildUser()]} />);

    await waitFor(() => {
      expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
        sort: 'lastName:asc',
      });
    });
    expect(screen.getByRole('columnheader', { name: /columns.lastName/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows trash on the unchecked list without an onDeleteUser prop and opens the delete dialog', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteAriaLabel:John Smith' }));
    expect(screen.getByTestId('delete-user-dialog')).toHaveTextContent('user-1');
  });

  it('treats a missing adminLegalEntityIds prop as able to manage the selected company', () => {
    expect(canManageSelectedCompanyUsers(undefined, 'le-other')).toBe(true);
    expect(canManageSelectedCompanyUsers(['le-admin'], 'le-admin')).toBe(true);
    expect(canManageSelectedCompanyUsers(['le-admin'], 'le-other')).toBe(false);
    expect(canManageSelectedCompanyUsers(['le-admin'], undefined)).toBe(false);
  });

  it('shows the table when session LE is missing but SSR recovered an Admin LE', () => {
    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID));
    mockUsersResult({ users: [buildUser()] });

    render(
      <UsersList
        initialUsers={[buildUser()]}
        selectedCompanyName="Emporix GmbH"
        headerCompanies={[{ id: 'le-admin', name: 'Emporix GmbH' }]}
        adminLegalEntityIds={['le-admin']}
        selectedLegalEntityId="le-admin"
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /createButton/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the recovered Admin LE when the client session company is stale', () => {
    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID, 'le-stale'));
    mockUsersResult({ users: [buildUser()] });

    render(
      <UsersList
        initialUsers={[buildUser()]}
        selectedCompanyName="Emporix GmbH"
        headerCompanies={[{ id: 'le-admin', name: 'Emporix GmbH' }]}
        adminLegalEntityIds={['le-admin']}
        selectedLegalEntityId="le-admin"
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /createButton/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the company-scope toggle only for an Admin session LE with more than one Admin LE', () => {
    expect(canShowCompanyScopeToggle(undefined, true, true)).toBe(true);
    expect(canShowCompanyScopeToggle(undefined, true, false)).toBe(false);
    expect(canShowCompanyScopeToggle(['le-admin'], true, true)).toBe(false);
    expect(canShowCompanyScopeToggle(['le-a', 'le-b'], true, false)).toBe(true);
    expect(canShowCompanyScopeToggle(['le-a', 'le-b'], false, true)).toBe(false);
  });

  it('hides the company-scope toggle when the customer is Admin of only one legal entity', () => {
    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID, 'le-admin'));
    mockUsersResult({ users: [buildUser()] });

    render(
      <UsersList
        initialUsers={[buildUser()]}
        showOtherCompaniesToggle
        selectedCompanyName="Emporix GmbH"
        headerCompanies={[
          { id: 'le-other', name: 'NovaTech' },
          { id: 'le-admin', name: 'Emporix GmbH' },
        ]}
        adminLegalEntityIds={['le-admin']}
      />,
    );

    expect(screen.queryByRole('radiogroup', { name: 'companyScope' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /createButton/i })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('replaces the table with the non-admin message and hides create and scope when the session company is not an Admin LE', () => {
    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID, 'le-other'));
    mockUsersResult({ users: [buildUser()] });
    mockOtherCompanyUsersResult();

    render(
      <UsersList
        initialUsers={[buildUser()]}
        showOtherCompaniesToggle
        selectedCompanyName="NovaTech"
        headerCompanies={[
          { id: 'le-other', name: 'NovaTech' },
          { id: 'le-admin', name: 'Emporix GmbH' },
        ]}
        adminLegalEntityIds={['le-admin']}
      />,
    );

    expect(screen.queryByRole('radiogroup', { name: 'companyScope' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /createButton/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('notifications.notAdminInCompany:{"company":"NovaTech"}');
    expect(mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1][1]).toMatchObject({
      enabled: false,
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('replaces the table with the non-admin message after the header company switcher leaves an Admin LE', () => {
    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID, 'le-admin'));
    mockUsersResult({ users: [buildUser()] });
    mockOtherCompanyUsersResult();

    const { rerender } = render(
      <UsersList
        initialUsers={[buildUser()]}
        showOtherCompaniesToggle
        selectedCompanyName="Emporix GmbH"
        headerCompanies={[
          { id: 'le-other', name: 'NovaTech' },
          { id: 'le-admin', name: 'Emporix GmbH' },
        ]}
        adminLegalEntityIds={['le-admin']}
      />,
    );

    expect(screen.getByRole('link', { name: /createButton/i })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    mockUseSession.mockReturnValue(authenticatedSession(AUTHENTICATED_CUSTOMER_ID, 'le-other'));
    rerender(
      <UsersList
        initialUsers={[buildUser()]}
        showOtherCompaniesToggle
        selectedCompanyName="Emporix GmbH"
        headerCompanies={[
          { id: 'le-other', name: 'NovaTech' },
          { id: 'le-admin', name: 'Emporix GmbH' },
        ]}
        adminLegalEntityIds={['le-admin']}
      />,
    );

    expect(screen.queryByRole('radiogroup', { name: 'companyScope' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /createButton/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('notifications.notAdminInCompany:{"company":"NovaTech"}');
  });
});
