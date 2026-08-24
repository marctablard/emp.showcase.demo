/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { USER_SORT_FIELD_MAP, UsersTable } from './users-table';

const mockPush = jest.fn();
const mockAcquireNavigationWaitCursorLease = jest.fn();

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
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/common/useGlobalCursor', () => ({
  useGlobalCursor: jest.fn(),
  acquireNavigationWaitCursorLease: (...args: unknown[]) => mockAcquireNavigationWaitCursorLease(...args),
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

describe('UsersTable', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockAcquireNavigationWaitCursorLease.mockClear();
  });
  it('maps Created to metadataCreatedAt and does not include userGroup in the sort map', () => {
    expect(USER_SORT_FIELD_MAP.metadataCreatedAt).toBe('metadataCreatedAt');
    expect(USER_SORT_FIELD_MAP).not.toHaveProperty('userGroup');
    expect(Object.values(USER_SORT_FIELD_MAP)).toEqual([
      'firstName',
      'lastName',
      'contactEmail',
      'metadataCreatedAt',
      'active',
    ]);
  });

  it('renders all AC columns including on a horizontally scrollable table', () => {
    const { container } = render(<UsersTable users={[buildUser()]} />);

    const headerCells = screen.getAllByRole('columnheader');
    const headers = headerCells.map((header) => header.textContent);
    expect(headers).toEqual([
      'columns.firstName',
      'columns.lastName',
      'columns.email',
      'columns.created',
      'columns.userGroup',
      'columns.status',
      'columns.actions',
    ]);
    headerCells.forEach((header) => {
      expect(header).toHaveClass('font-headlines', 'text-2xl', 'font-bold', 'text-text-headings');
    });

    const tableContainer = container.querySelector('[data-slot="table-container"]');
    expect(tableContainer).toHaveClass('overflow-x-auto');
    expect(tableContainer).toHaveClass('overflow-y-clip');
    expect(tableContainer).toHaveClass('min-w-0');

    const table = container.querySelector('table');
    expect(table).toHaveClass('min-w-[1124px]');
    expect(table).toHaveClass('transition-[min-width]');
    expect(table).not.toHaveClass('lg:table-fixed');
    expect(table).not.toHaveClass('lg:min-w-0');
    expect(table).not.toHaveClass('table-fixed');
    expect(table).not.toHaveClass('md:min-w-0');
  });

  it('does not truncate User Group or email and keeps nowrap cells for horizontal scroll', () => {
    const longGroupName =
      'Acme Industrial Holdings International - Requestor, Acme Industrial Holdings International - Buyer';
    const longEmail = 'very.long.user.email.address@industrial-holdings.example.com';
    const { container } = render(
      <UsersTable
        users={[
          buildUser({
            contactEmail: longEmail,
            groups: [{ id: 'g-1', legalEntityId: 'le-1', displayName: longGroupName }],
          }),
        ]}
      />,
    );

    const groupCell = screen.getByText(longGroupName);
    expect(groupCell).not.toHaveClass('truncate');
    expect(groupCell).not.toHaveClass('max-w-[248px]');
    expect(groupCell.closest('td')).toHaveClass('whitespace-nowrap');
    expect(groupCell.closest('td')).not.toHaveClass('max-w-[248px]');
    expect(groupCell.closest('td')).not.toHaveClass('truncate');

    const emailCell = screen.getByText(longEmail);
    expect(emailCell).not.toHaveClass('truncate');
    expect(emailCell.closest('td')).toHaveClass('whitespace-nowrap');

    const userGroupHeader = screen.getByRole('columnheader', { name: 'columns.userGroup' });
    expect(userGroupHeader).not.toHaveClass('max-w-[248px]');
    expect(container.querySelector('table')).toHaveClass('w-full');
    expect(container.querySelector('table')).not.toHaveClass('lg:table-fixed');
    expect(container.querySelector('table')).not.toHaveClass('lg:min-w-0');
  });

  it('shows Contact only when the user has no functional source-LE groups', () => {
    render(
      <UsersTable
        users={[
          buildUser({ groups: [] }),
          buildUser({
            id: 'user-2',
            firstName: 'Pat',
            groups: [{ id: 'g-contact', legalEntityId: 'le-1', displayName: 'NovaTech - Contact' }],
          }),
        ]}
      />,
    );

    expect(screen.getAllByText('form.contactOnly')).toHaveLength(2);
    expect(screen.queryByText('NovaTech - Contact')).not.toBeInTheDocument();
  });

  it('keeps User Group and Actions non-sortable', () => {
    render(<UsersTable users={[buildUser()]} />);

    const userGroupHeader = screen.getByRole('columnheader', { name: 'columns.userGroup' });
    expect(within(userGroupHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(userGroupHeader).not.toHaveAttribute('aria-sort');

    const actionsHeader = screen.getByRole('columnheader', { name: 'columns.actions' });
    expect(within(actionsHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(actionsHeader).not.toHaveAttribute('aria-sort');
  });

  it('inserts a non-sortable Legal Entity Name column after Last Name when showLegalEntityName is true', () => {
    const { container } = render(
      <UsersTable showLegalEntityName users={[buildUser({ legalEntityId: 'le-1', legalEntityName: 'Acme GmbH' })]} />,
    );

    const headerCells = screen.getAllByRole('columnheader');
    expect(headerCells.map((header) => header.textContent)).toEqual([
      'columns.firstName',
      'columns.lastName',
      'columns.legalEntityName',
      'columns.email',
      'columns.created',
      'columns.userGroup',
      'columns.status',
      'columns.actions',
    ]);

    const legalEntityHeader = screen.getByRole('columnheader', { name: 'columns.legalEntityName' });
    expect(within(legalEntityHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(legalEntityHeader).not.toHaveAttribute('aria-sort');

    const legalEntityCell = screen.getByText('Acme GmbH');
    expect(legalEntityCell).not.toHaveClass('truncate');
    expect(legalEntityCell.closest('td')).toHaveClass('whitespace-nowrap');
    expect(legalEntityCell.closest('td')).not.toHaveClass('max-w-[248px]');

    const table = container.querySelector('table');
    expect(table).toHaveClass('min-w-[1372px]');
    expect(table).not.toHaveClass('min-w-[1124px]');
    expect(table).not.toHaveClass('lg:table-fixed');
    expect(table).not.toHaveClass('lg:min-w-0');
  });

  it('renders two rows with the same id when legalEntityId differs', () => {
    render(
      <UsersTable
        showLegalEntityName
        users={[
          buildUser({
            id: 'user-1',
            legalEntityId: 'le-a',
            legalEntityName: 'Alpha Co',
            contactEmail: 'john.alpha@mail.com',
          }),
          buildUser({
            id: 'user-1',
            legalEntityId: 'le-b',
            legalEntityName: 'Beta Co',
            contactEmail: 'john.beta@mail.com',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Alpha Co')).toBeInTheDocument();
    expect(screen.getByText('Beta Co')).toBeInTheDocument();
    expect(screen.getByText('john.alpha@mail.com')).toBeInTheDocument();
    expect(screen.getByText('john.beta@mail.com')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('calls onToggleSort with metadataCreatedAt for the Created column', () => {
    const onToggleSort = jest.fn();
    render(<UsersTable users={[buildUser()]} onToggleSort={onToggleSort} />);

    fireEvent.click(within(screen.getByRole('columnheader', { name: /columns.created/ })).getByRole('button'));
    expect(onToggleSort).toHaveBeenCalledWith('metadataCreatedAt');
  });

  it('renders ACTIVE and INACTIVE status badges', () => {
    render(
      <UsersTable
        users={[
          buildUser({ id: 'active-user', active: true }),
          buildUser({ id: 'inactive-user', firstName: 'Jane', active: false }),
        ]}
      />,
    );

    const activeBadge = screen.getByText('status.active');
    const inactiveBadge = screen.getByText('status.inactive');
    expect(activeBadge).toHaveAttribute('data-slot', 'badge');
    expect(inactiveBadge).toHaveAttribute('data-slot', 'badge');
    expect(activeBadge).toHaveClass('bg-surface-success');
    expect(inactiveBadge).toHaveClass('bg-surface-error');
  });

  it('wires edit to /account/users/[id] and delete to the Phase 4 callback', () => {
    const onDeleteUser = jest.fn();
    const user = buildUser();
    render(<UsersTable users={[user]} onDeleteUser={onDeleteUser} />);

    expect(screen.getByRole('link', { name: 'editAriaLabel:John Smith' })).toHaveAttribute(
      'href',
      '/account/users/user-1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'deleteAriaLabel:John Smith' }));
    expect(onDeleteUser).toHaveBeenCalledWith(user);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to edit on row click and does not navigate when delete is clicked', () => {
    const onDeleteUser = jest.fn();
    render(<UsersTable users={[buildUser()]} onDeleteUser={onDeleteUser} />);

    fireEvent.click(screen.getByText('j.smith@mail.com'));
    expect(mockAcquireNavigationWaitCursorLease).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/account/users/user-1');

    mockPush.mockClear();
    mockAcquireNavigationWaitCursorLease.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'deleteAriaLabel:John Smith' }));
    expect(onDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockAcquireNavigationWaitCursorLease).not.toHaveBeenCalled();
  });

  it('omits delete controls when onDeleteUser is not provided', () => {
    render(<UsersTable users={[buildUser()]} />);

    expect(screen.queryByRole('button', { name: 'deleteAriaLabel:John Smith' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'editAriaLabel:John Smith' })).toHaveAttribute(
      'href',
      '/account/users/user-1',
    );
  });

  it('shows the no-results string when an active search has no hits', () => {
    render(<UsersTable users={[]} hasActiveSearch />);

    expect(screen.getByText('noResults')).toBeInTheDocument();
  });
});
