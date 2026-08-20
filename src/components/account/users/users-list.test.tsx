/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { UsersList, showOtherCompanyUsersStorageKey } from './users-list';

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
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values && 'name' in values) {
      return `${key}:${values.name}`;
    }
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
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
  pageSize: 5,
  sort: 'firstName:asc',
  query: undefined,
};

const AUTHENTICATED_CUSTOMER_ID = 'admin-customer-1';
const OTHER_ADMIN_CUSTOMER_ID = 'other-admin-2';

function authenticatedSession(customerId = AUTHENTICATED_CUSTOMER_ID) {
  return { session: { customerId } };
}

describe('UsersList', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
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
      pageSize: 5,
      sort: 'firstName:asc',
      initialTotalCount: 1,
      initialRequest: {
        pageNumber: 1,
        pageSize: 5,
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
    expect(heading.parentElement?.parentElement).toHaveClass('flex', 'flex-col', 'gap-6', 'lg:gap-12');
    expect(heading.parentElement).toHaveClass(
      'flex',
      'flex-col',
      'items-start',
      'gap-6',
      'md:flex-row',
      'md:flex-nowrap',
      'md:justify-between',
    );
    expect(heading.parentElement).not.toHaveClass('flex-wrap');
    expect(heading.parentElement).not.toHaveClass('gap-4');
    expect(heading.parentElement).not.toHaveClass('justify-between');
    expect(heading).toHaveClass('min-w-0', 'w-full', 'whitespace-nowrap', 'md:w-auto', 'md:flex-1');
    expect(heading).not.toHaveClass('flex-1');
    const createCta = screen.getByRole('link', { name: /createButton/i });
    expect(createCta).toHaveAttribute('href', '/account/users/new');
    expect(createCta).toHaveClass('font-headlines');
    expect(createCta).toHaveClass('text-action-button');
    expect(createCta).toHaveClass('tracking-[var(--desktop-spacing-action-button)]');
    expect(createCta).toHaveClass('h-12', 'w-auto', 'shrink-0', 'whitespace-nowrap');
    expect(createCta).not.toHaveClass('w-full');
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

    const tableCards = container.querySelectorAll('[data-slot="table-card"]');
    expect(tableCards).toHaveLength(1);
    expect(tableCards[0].querySelector('table')).not.toBeNull();
    expect(tableCards[0].querySelector('input')).not.toBeNull();
    expect(tableCards[0]).toHaveClass('p-4');
    const searchField = tableCards[0].querySelector('form > div');
    expect(searchField).toHaveClass('w-[380px]');
    expect(searchField).toHaveClass('max-w-full');
    const searchInput = tableCards[0].querySelector('input');
    expect(searchInput).toHaveClass('h-12');
    expect(searchInput).toHaveClass('bg-surface-primary');
    expect(searchInput).toHaveClass('border-border-primary');
    expect(searchInput).toHaveClass('[&::-webkit-search-cancel-button]:hidden');
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

  it('hides the other-companies checkbox when showOtherCompaniesToggle is false', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} />);

    expect(screen.queryByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeInTheDocument();
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('shows an unchecked other-companies checkbox immediately left of CREATE NEW USER for multi-company admins', () => {
    mockUsersResult({ users: [buildUser()] });
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    const checkbox = screen.getByRole('checkbox', { name: 'showOtherCompanies' });
    const createCta = screen.getByRole('link', { name: /createButton/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(createCta).toHaveAttribute('href', '/account/users/new');
    expect(checkbox.compareDocumentPosition(createCta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'showOtherCompanies' }));

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="table-card"]')).toHaveLength(1);
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).toBeChecked();

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

    const checkbox = screen.getByRole('checkbox', { name: 'showOtherCompanies' });
    fireEvent.click(checkbox);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('Pat')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'columns.legalEntityName' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'deleteAriaLabel:John Smith' })).not.toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
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
      pageSize: 5,
      sort: 'firstName:asc',
      enabled: true,
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);

    fireEvent.click(screen.getByRole('checkbox', { name: 'showOtherCompanies' }));

    const [, firstTableOptionsAfter] = mockUseCompanyUsers.mock.calls[mockUseCompanyUsers.mock.calls.length - 1];
    expect(firstTableOptionsAfter).toMatchObject({
      pageNumber: 1,
      pageSize: 5,
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
      pageSize: 5,
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'showOtherCompanies' }));
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'showOtherCompanies' }));

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'John S' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      enabled: true,
      pageNumber: 1,
      pageSize: 5,
      sort: 'firstName:asc',
      query: 'John S',
    });

    fireEvent.click(screen.getByRole('button', { name: /columns.lastName/ }));
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      enabled: true,
      pageNumber: 1,
      pageSize: 5,
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'showOtherCompanies' }));

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
      expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).toBeChecked();
    });
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith({
      ...DEFAULT_OTHER_COMPANY_USERS_OPTIONS,
      enabled: true,
    });

    unmount();
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).toBeChecked();
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
    const checkbox = screen.getByRole('checkbox', { name: 'showOtherCompanies' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem(storageKey)).toBe('false');

    unmount();
    localStorage.setItem(storageKey, 'false');
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
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
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
    expect(mockUseOtherCompanyUsers).toHaveBeenCalledWith(DEFAULT_OTHER_COMPANY_USERS_OPTIONS);
  });

  it('leaves the checkbox unchecked for invalid JSON, a missing key, or missing/ANONYMOUS userId and does not write without a userId', () => {
    const storageKey = showOtherCompanyUsersStorageKey(AUTHENTICATED_CUSTOMER_ID);
    mockUsersResult({ users: [buildUser()] });

    localStorage.setItem(storageKey, '{not-json');
    const invalidJson = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
    invalidJson.unmount();
    localStorage.clear();

    const missingKey = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
    missingKey.unmount();

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    mockUseSession.mockReturnValue({ session: {} });
    const missingUserId = render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
    expect(setItemSpy.mock.calls.filter(([key]) => String(key).startsWith('user-management.v1:'))).toHaveLength(0);
    missingUserId.unmount();
    setItemSpy.mockRestore();

    localStorage.setItem(showOtherCompanyUsersStorageKey(CUSTOMER_ID.SESSION_ANONYMOUS), 'true');
    mockUseSession.mockReturnValue({ session: { customerId: CUSTOMER_ID.SESSION_ANONYMOUS } });
    render(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
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
      expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).toBeChecked();
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
    expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).not.toBeChecked();
    expect(localStorage.getItem(storageKey)).toBe('true');
    expect(persistOptionsLog).toEqual(expect.arrayContaining([expect.objectContaining({ enabled: false })]));
    expect(persistOptionsLog).not.toEqual(expect.arrayContaining([expect.objectContaining({ enabled: true })]));

    mockUseSession.mockReturnValue(authenticatedSession());
    rerender(<UsersList initialUsers={[buildUser()]} showOtherCompaniesToggle />);
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'showOtherCompanies' })).toBeChecked();
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
});
