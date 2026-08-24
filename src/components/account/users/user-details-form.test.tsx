/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { CONTACT_ONLY_GROUP_ID } from '@/platform/services/model/user-management/contact-only';
import { UserDetailsForm, buildOtherHeaderCompanyGroupSections } from './user-details-form';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockNotify = jest.fn();
const mockCreateCompanyUser = jest.fn();
const mockUpdateCompanyUser = jest.fn();
const mockFetchGroups = jest.fn();
let mockSession: { legalEntityId?: unknown } = { legalEntityId: 'le-1' };
const mockTranslation = (key: string, values?: Record<string, string>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;
mockTranslation.raw = (key: string) => mockTranslation(key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslation,
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/lib/client/user-management', () => ({
  createCompanyUser: (...args: unknown[]) => mockCreateCompanyUser(...args),
  updateCompanyUser: (...args: unknown[]) => mockUpdateCompanyUser(...args),
  fetchAssignableCompanyUserGroups: (...args: unknown[]) => mockFetchGroups(...args),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Success: 'success', Error: 'error', Warning: 'warning' },
  notify: (...args: unknown[]) => mockNotify(...args),
}));

jest.mock('@/components/ui/select', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const SelectContext = React.createContext<{ onValueChange?: (value: string) => void; value?: string }>({});

  return {
    Select: ({
      children,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
      value?: string;
    }) => {
      React.useEffect(() => {
        if (value === undefined) return;
        onValueChange?.('__none__');
        onValueChange?.(value);
      }, []);

      return <SelectContext.Provider value={{ onValueChange, value }}>{children}</SelectContext.Provider>;
    },
    SelectTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) => (
      <span>{children ?? placeholder}</span>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const { onValueChange, value: selectedValue } = React.useContext(SelectContext);
      return (
        <button type="button" data-select-item={value} onClick={() => onValueChange?.(value)}>
          {selectedValue === value ? null : children}
        </button>
      );
    },
  };
});

const assignableGroups = [
  {
    legalEntityId: 'le-1',
    legalEntityName: 'Selected Company',
    groups: [
      {
        id: 'group-1',
        legalEntityId: 'le-1',
        legalEntityName: 'Selected Company',
        displayName: 'Selected Company - Admin',
      },
    ],
  },
  {
    legalEntityId: 'le-2',
    legalEntityName: 'Other Company',
    groups: [
      {
        id: 'group-2',
        legalEntityId: 'le-2',
        legalEntityName: 'Other Company',
        displayName: 'Other Company - Buyer',
      },
    ],
  },
];
const orderedAssignableGroups = [
  {
    legalEntityId: 'le-1',
    legalEntityName: 'Selected Company',
    groups: [
      { id: 'requestor-group', legalEntityId: 'le-1', legalEntityName: 'Selected Company', displayName: 'Requestor' },
      { id: 'contact-group', legalEntityId: 'le-1', legalEntityName: 'Selected Company', displayName: 'Contact' },
      { id: 'buyer-group', legalEntityId: 'le-1', legalEntityName: 'Selected Company', displayName: 'Buyer' },
      { id: 'admin-group', legalEntityId: 'le-1', legalEntityName: 'Selected Company', displayName: 'Admin' },
    ],
  },
];
const headerCompanies = [
  { id: 'le-1', name: 'NovaTech' },
  { id: 'le-2', name: 'Other Company' },
];
const emporixHeaderCompanies = [
  { id: 'le-1', name: 'NovaTech' },
  { id: 'le-2', name: 'Emporix GmbH' },
];

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('form.firstName'), { target: { value: 'John' } });
  fireEvent.change(screen.getByLabelText('form.lastName'), { target: { value: 'Smith' } });
  fireEvent.change(screen.getByLabelText('form.email'), { target: { value: 'john@example.com' } });
}

function dirtyEditForm() {
  fireEvent.change(screen.getByLabelText('form.lastName'), { target: { value: 'Doette' } });
}

function formLabel(text: string) {
  return screen.getByText(text).closest('[data-slot="label"]');
}

function userGroupSelectTriggers() {
  return screen.queryAllByRole('button').filter((element) => element.id.startsWith('company-user-group-'));
}

async function flushGroupSelectHydrate() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

async function showActivateHelper(target: HTMLElement) {
  fireEvent.pointerMove(target, { pointerType: 'mouse' });
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveAttribute('data-slot', 'tooltip-content');
  expect(tooltip).toHaveTextContent('form.activateUserHelper');
  expect(tooltip.querySelector('svg')).toHaveClass('text-icon-information');
}

function buildInitialUser(overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Doe',
    contactEmail: 'jane@example.com',
    active: true,
    groups: [{ id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' }],
    ...overrides,
  };
}

describe('UserDetailsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = { legalEntityId: 'le-1' };
    mockFetchGroups.mockResolvedValue(assignableGroups);
  });

  it('renders no password input and exactly one selected-company group selector', async () => {
    render(<UserDetailsForm />);

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText(/form\.userGroupForCompany.*Other Company/)).not.toBeInTheDocument();
    expect(screen.queryByText('Other Company - Buyer')).not.toBeInTheDocument();
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.getByLabelText(/form\.phone/)).not.toBeRequired();
  });

  it('shows the single groups-API company dropdown when the session has no legal entity', async () => {
    mockSession = {};
    mockFetchGroups.mockResolvedValueOnce([assignableGroups[0]]);

    render(<UserDetailsForm />);

    await waitFor(() =>
      expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toBeInTheDocument(),
    );
    expect(screen.getByText('Selected Company - Admin')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/form\.userGroupForCompany/).filter((el) => el.tagName === 'BUTTON')).toHaveLength(
      1,
    );
    expect(userGroupSelectTriggers()).toHaveLength(1);
  });

  it('keeps mobile, tablet, and desktop form styles separate', async () => {
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');

    expect(screen.getByText('form.userDetails').closest('[data-slot="card"]')).toHaveClass('p-4', 'lg:p-6');
    expect(screen.getByLabelText(/form\.title/).parentElement).toHaveClass('w-full', 'md:w-[254px]', 'lg:w-66');
    expect(screen.queryByText('form.activateUserHelper')).not.toBeInTheDocument();
  });

  it('marks title and phone as optional and keeps name and email required', async () => {
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');

    expect(formLabel('form.title')).toHaveTextContent('optional');
    expect(formLabel('form.phone')).toHaveTextContent('optional');
    expect(formLabel('form.firstName')).not.toHaveTextContent('optional');
    expect(formLabel('form.lastName')).not.toHaveTextContent('optional');
    expect(formLabel('form.email')).not.toHaveTextContent('optional');
  });

  it('requires one group for the selected legal entity', async () => {
    render(<UserDetailsForm />);
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toBeInTheDocument(),
    );
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    const groupError = await screen.findByRole('alert');
    expect(groupError).toHaveTextContent('validation.requiredGroup');
    expect(groupError).toHaveAttribute('id', 'company-user-group-assignments-error');
    expect(mockCreateCompanyUser).not.toHaveBeenCalled();
  });

  it('allows an ungrouped edit user to save profile changes without submitting hidden assignments', async () => {
    mockUpdateCompanyUser.mockResolvedValue(undefined);
    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          groups: [{ id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' }],
        })}
      />,
    );
    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockUpdateCompanyUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateCompanyUser.mock.calls[0][1]).not.toHaveProperty('groupAssignments');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toHaveTextContent(
      'form.groupPlaceholder',
    );
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /form\.userGroupForCompany.*Other Company/ })).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
  });

  it('disables create Save until the form is dirty', async () => {
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('form.firstName'), { target: { value: 'John' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  });

  it('disables edit Save until a field or group dropdown changes', async () => {
    const { unmount } = render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('form.firstName'), { target: { value: 'Janet' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
    unmount();

    render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.click(screen.getByText('form.groupPlaceholder'));
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  });

  it('submits an empty assignment list when an existing edit group is cleared', async () => {
    mockUpdateCompanyUser.mockResolvedValue(undefined);
    render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    fireEvent.click(screen.getByText('form.groupPlaceholder'));
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockUpdateCompanyUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ groupAssignments: [] })),
    );
    expect(mockUpdateCompanyUser.mock.calls[0][1].groupAssignments).toEqual([]);
  });

  it('submits one selected-company assignment when assigning an ungrouped edit user', async () => {
    mockUpdateCompanyUser.mockResolvedValue(undefined);
    render(<UserDetailsForm initialUser={buildInitialUser({ groups: [] })} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toHaveTextContent(
      'form.groupPlaceholder',
    );
    fireEvent.click(screen.getByText('Selected Company - Admin'));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockUpdateCompanyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
        }),
      ),
    );
  });

  it('keeps edit Save disabled after async group Selects mount without user edits', async () => {
    mockFetchGroups.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(assignableGroups), 20)));
    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          title: 'MR',
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' },
          ],
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    await screen.findByText('Selected Company - Admin');
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
    await flushGroupSelectHydrate();

    const save = screen.getByRole('button', { name: 'save' });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('disabled');

    fireEvent.change(screen.getByLabelText('form.firstName'), { target: { value: 'Janet' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  });

  it('does not enable edit Save when Title onValueChange repeats the current title after hydrate', async () => {
    render(<UserDetailsForm initialUser={buildInitialUser({ title: 'MR' })} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/form\.title/).parentElement!.querySelector('[data-select-item="MR"]')!);
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
  });

  it('hides the activate helper until hover of the checkbox or label', async () => {
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');

    expect(screen.queryByText('form.activateUserHelper')).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await showActivateHelper(screen.getByRole('checkbox', { name: 'form.activateUser' }));
  });

  it('shows the activate helper on hover of the Activate user label', async () => {
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');

    expect(screen.queryByText('form.activateUserHelper')).not.toBeInTheDocument();
    await showActivateHelper(screen.getByText('form.activateUser'));
  });

  it('surfaces the required-group error when no picker value is chosen', async () => {
    mockFetchGroups.mockResolvedValueOnce([{ legalEntityId: 'le-1', legalEntityName: 'Selected Company', groups: [] }]);
    render(<UserDetailsForm />);

    await waitFor(() => expect(screen.getByText('form.contactOnly')).toBeInTheDocument());
    expect(screen.queryByText('form.noGroupsAvailable')).not.toBeInTheDocument();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('validation.requiredGroup');
    expect(mockCreateCompanyUser).not.toHaveBeenCalled();
  });

  it('navigates to the list and warns after partial create success', async () => {
    mockCreateCompanyUser.mockResolvedValue({
      user: { id: 'user-1' },
      failedGroupNames: ['Other Company - Buyer'],
    });
    render(<UserDetailsForm />);
    await waitFor(() => expect(screen.getByText('Selected Company - Admin')).toBeInTheDocument());
    fillRequiredFields();
    fireEvent.click(screen.getByText('Selected Company - Admin'));

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockCreateCompanyUser).toHaveBeenCalledTimes(1));
    expect(mockCreateCompanyUser.mock.calls[0][0]).toMatchObject({
      firstName: 'John',
      lastName: 'Smith',
      contactEmail: 'john@example.com',
      active: false,
      groupAssignments: [{ legalEntityId: 'le-1', groupId: 'group-1' }],
    });
    expect(mockCreateCompanyUser.mock.calls[0][0]).not.toHaveProperty('password');
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', duration: 4000 }));
    expect(mockPush).toHaveBeenCalledWith('/account/users');
  });

  it('includes the create activation value only when the form is submitted', async () => {
    mockCreateCompanyUser.mockResolvedValue({ user: { id: 'user-1' } });
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');
    fillRequiredFields();
    fireEvent.click(screen.getByText('Selected Company - Admin'));

    fireEvent.click(screen.getByRole('checkbox', { name: 'form.activateUser' }));

    expect(mockCreateCompanyUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockCreateCompanyUser).toHaveBeenCalledWith(expect.objectContaining({ active: true })));
  });

  it('keeps activation local until Save and uses the status success notification', async () => {
    mockUpdateCompanyUser.mockResolvedValue(undefined);
    render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();

    const activeCheckbox = screen.getByRole('checkbox', { name: 'form.activeUser' });
    expect(activeCheckbox).toBeChecked();
    expect(screen.getByText('status.active')).toHaveClass(
      'border-border-success',
      'bg-surface-success',
      'text-text-success',
    );

    fireEvent.click(activeCheckbox);

    expect(mockUpdateCompanyUser).not.toHaveBeenCalled();
    expect(screen.getByText('status.active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockUpdateCompanyUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ active: false })),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'notifications.statusSuccess', type: 'success', duration: 4000 }),
    );
    expect(mockPush).toHaveBeenCalledWith('/account/users');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('omits group assignments when an edit saves other fields without changing the dropdown', async () => {
    mockUpdateCompanyUser.mockResolvedValue(undefined);
    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' },
          ],
        })}
      />,
    );
    await screen.findByText('Selected Company - Admin');
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
    await flushGroupSelectHydrate();

    dirtyEditForm();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockUpdateCompanyUser).toHaveBeenCalledWith(
        'user-1',
        expect.not.objectContaining({
          groupAssignments: expect.anything(),
        }),
      ),
    );
    expect(mockUpdateCompanyUser.mock.calls[0][1]).not.toHaveProperty('groupAssignments');
  });

  it('preselects the selected-company group by id and hides other-company groups', async () => {
    render(
      <UserDetailsForm
        headerCompanies={[
          { id: 'le-1', name: 'NovaTech' },
          { id: 'get-user-le-2', name: 'Emporix GmbH' },
        ]}
        initialUser={buildInitialUser({
          groups: [
            {
              id: 'group-1',
              legalEntityId: 'le-1',
              displayName: 'Stale selected-company label',
            },
            {
              id: 'group-2',
              legalEntityId: 'get-user-le-2',
              displayName: 'Other Company - Buyer',
            },
          ],
        })}
      />,
    );

    const selectedCompanyTrigger = await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);

    await waitFor(() => {
      expect(within(selectedCompanyTrigger).getByText('Selected Company - Admin')).toBeInTheDocument();
      expect(selectedCompanyTrigger).not.toHaveTextContent('form.groupPlaceholder');
    });
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /form\.userGroupForCompany.*Emporix GmbH/ })).not.toBeInTheDocument();
    expect(screen.getByText(/form\.userGroupForCompany.*Emporix GmbH/)).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
  });

  it('prefers the selected-company predefined group over contact when both are assigned', async () => {
    mockFetchGroups.mockResolvedValueOnce(orderedAssignableGroups);
    render(
      <UserDetailsForm
        initialUser={buildInitialUser({
          groups: [
            { id: 'contact-group', legalEntityId: 'le-1', displayName: 'Contact' },
            { id: 'admin-group', legalEntityId: 'le-1', displayName: 'Admin' },
          ],
        })}
      />,
    );

    const selectedGroupTrigger = await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    await waitFor(() => expect(within(selectedGroupTrigger).getByText('Admin')).toBeInTheDocument());
    expect(selectedGroupTrigger).not.toHaveTextContent('Contact');
    expect(selectedGroupTrigger).not.toHaveTextContent('form.groupPlaceholder');
  });

  it('preselects contact when it is the only selected-company assignment', async () => {
    mockFetchGroups.mockResolvedValueOnce(orderedAssignableGroups);
    render(
      <UserDetailsForm
        initialUser={buildInitialUser({
          groups: [{ id: 'contact-group', legalEntityId: 'le-1', displayName: 'Contact' }],
        })}
      />,
    );

    const selectedGroupTrigger = await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    await waitFor(() => expect(within(selectedGroupTrigger).getByText('form.contactOnly')).toBeInTheDocument());
    expect(selectedGroupTrigger).not.toHaveTextContent('Contact');
    expect(screen.queryByRole('button', { name: /^Contact$/ })).not.toBeInTheDocument();
  });

  it('shows placeholder and keeps Save disabled for ungrouped selected-company edit until dirty', async () => {
    render(
      <UserDetailsForm
        initialUser={buildInitialUser({
          groups: [{ id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' }],
        })}
      />,
    );

    const selectedGroupTrigger = await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    await flushGroupSelectHydrate();
    expect(selectedGroupTrigger).toHaveTextContent('form.groupPlaceholder');
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('form.firstName'), { target: { value: 'Janet' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  });

  it('keeps Admin preselect after delayed groups hydration and reset', async () => {
    mockFetchGroups.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([
                {
                  legalEntityId: 'le-1',
                  legalEntityName: 'Selected Company',
                  groups: [
                    {
                      id: 'contact-group',
                      legalEntityId: 'le-1',
                      legalEntityName: 'Selected Company',
                      displayName: 'Contact',
                    },
                    {
                      id: 'admin-group',
                      legalEntityId: 'le-1',
                      legalEntityName: 'Selected Company',
                      displayName: 'Admin',
                    },
                  ],
                },
              ]),
            20,
          ),
        ),
    );
    render(
      <UserDetailsForm
        initialUser={buildInitialUser({
          groups: [
            { id: 'admin-group', legalEntityId: 'le-1', displayName: 'Admin' },
            { id: 'contact-group', legalEntityId: 'le-1', displayName: 'Contact' },
          ],
        })}
      />,
    );

    const selectedGroupTrigger = await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    await flushGroupSelectHydrate();
    await waitFor(() => expect(selectedGroupTrigger).toHaveTextContent('Admin'));
    expect(selectedGroupTrigger).not.toHaveTextContent('form.groupPlaceholder');
  });

  it('merges only the selected-company assignment when its live options are empty', async () => {
    mockFetchGroups.mockResolvedValueOnce([
      { legalEntityId: 'le-1', legalEntityName: 'Selected Company', groups: [] },
      { legalEntityId: 'le-2', legalEntityName: 'Other Company', groups: [] },
    ]);

    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          groups: [
            {
              id: 'selected-assigned-group',
              legalEntityId: 'le-1',
              displayName: 'Selected Company - Admin',
            },
            {
              id: 'other-assigned-group',
              legalEntityId: 'le-2',
              displayName: 'Other Company - Buyer',
            },
          ],
        })}
      />,
    );

    expect(await screen.findByText('Selected Company - Admin')).toBeInTheDocument();
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
    expect(screen.queryAllByText('form.groupPlaceholder')).toHaveLength(1);
  });

  it('shows the safe same-company create error through the existing notification path', async () => {
    const sameCompanyError = 'Customer can only assign new customer to the same company';
    mockCreateCompanyUser.mockRejectedValue(new Error(sameCompanyError));
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');
    fillRequiredFields();
    fireEvent.click(screen.getByText('Selected Company - Admin'));

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: sameCompanyError, type: 'error', duration: 4000 }),
      ),
    );
  });

  it('shows predefined-group conflict toast copy for create failures', async () => {
    const predefinedConflictError = Object.assign(new Error('conflict'), { code: 'PREDEFINED_GROUP_CONFLICT' });
    mockCreateCompanyUser.mockRejectedValue(predefinedConflictError);
    render(<UserDetailsForm />);
    await screen.findByText('Selected Company - Admin');
    fillRequiredFields();
    fireEvent.click(screen.getByText('Selected Company - Admin'));

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'notifications.predefinedGroupConflict', type: 'error', duration: 4000 }),
      ),
    );
  });

  it('shows predefined-group conflict toast copy for edit failures', async () => {
    const predefinedConflictError = Object.assign(new Error('conflict'), { code: 'PREDEFINED_GROUP_CONFLICT' });
    mockUpdateCompanyUser.mockRejectedValue(predefinedConflictError);
    render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await screen.findByText('Selected Company - Admin');
    await flushGroupSelectHydrate();
    dirtyEditForm();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'notifications.predefinedGroupConflict', type: 'error', duration: 4000 }),
      ),
    );
  });

  it('shows the persisted INACTIVE detail badge', async () => {
    render(<UserDetailsForm initialUser={buildInitialUser({ active: false })} />);
    await screen.findByText('Selected Company - Admin');

    expect(screen.getByText('status.inactive')).toHaveClass(
      'border-border-error',
      'bg-surface-error',
      'text-text-error',
    );
    expect(screen.getByRole('checkbox', { name: 'form.activateUser' })).not.toBeChecked();
  });

  it('keeps the edit form mounted and does not navigate when update fails', async () => {
    mockUpdateCompanyUser.mockRejectedValue(new Error('update failed'));
    render(<UserDetailsForm initialUser={buildInitialUser()} />);
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.userGroupForCompany.*Selected Company/)).toBeInTheDocument(),
    );
    await flushGroupSelectHydrate();

    dirtyEditForm();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockUpdateCompanyUser).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'notifications.saveError', type: 'error', duration: 4000 }),
    );
  });

  it('cancel returns to the user list', async () => {
    render(<UserDetailsForm />);
    await waitFor(() => expect(screen.getByText('Selected Company - Admin')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(mockPush).toHaveBeenCalledWith('/account/users');
  });

  it('shows a read-only heading and displayName bullets for other header companies on edit', async () => {
    render(
      <UserDetailsForm
        headerCompanies={emporixHeaderCompanies}
        initialUser={buildInitialUser({
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'g-req', legalEntityId: 'le-2', displayName: 'Emporix GmbH - Requester' },
            { id: 'g-contact', legalEntityId: 'le-2', displayName: 'Emporix GmbH - Contact' },
          ],
        })}
      />,
    );

    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.getByText(/form\.userGroupForCompany.*"company":"Emporix GmbH"/)).toBeInTheDocument();
    const otherCompanyList = screen.getByRole('list');
    expect(otherCompanyList).toHaveTextContent('Emporix GmbH - Requester');
    expect(otherCompanyList).toHaveTextContent('Emporix GmbH - Contact');
    expect(
      screen.queryByRole('button', { name: /form\.userGroupForCompany.*"company":"Emporix GmbH"/ }),
    ).not.toBeInTheDocument();
  });

  it('does not render the read-only other-LE block on create even with header companies and mock groups', async () => {
    render(<UserDetailsForm headerCompanies={emporixHeaderCompanies} />);

    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.queryByText(/form\.userGroupForCompany.*"company":"Emporix GmbH"/)).not.toBeInTheDocument();
    expect(screen.queryByText('Emporix GmbH - Requester')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Company - Buyer')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('omits the derived selected legal entity from read-only sections when session id is empty', async () => {
    mockSession = {};
    mockFetchGroups.mockResolvedValueOnce([assignableGroups[0]]);
    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' },
          ],
        })}
      />,
    );

    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    expect(userGroupSelectTriggers()).toHaveLength(1);
    expect(screen.queryByText(/form\.userGroupForCompany.*"company":"NovaTech"/)).not.toBeInTheDocument();
    expect(screen.getByText(/form\.userGroupForCompany.*"company":"Other Company"/)).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Other Company - Buyer');
  });

  it('renders no other-LE sections while the derived selected legal entity id is empty', async () => {
    mockSession = {};
    render(
      <UserDetailsForm
        headerCompanies={headerCompanies}
        initialUser={buildInitialUser({
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' },
          ],
        })}
      />,
    );

    await waitFor(() => expect(screen.queryByText('form.loadingGroups')).not.toBeInTheDocument());
    expect(userGroupSelectTriggers()).toHaveLength(0);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Company - Buyer')).not.toBeInTheDocument();
  });

  it('uses the header company name for the read-only heading instead of a parsed displayName prefix', async () => {
    render(
      <UserDetailsForm
        headerCompanies={[
          { id: 'le-1', name: 'NovaTech' },
          { id: 'le-2', name: 'Official GmbH' },
        ]}
        initialUser={buildInitialUser({
          groups: [
            { id: 'group-1', legalEntityId: 'le-1', displayName: 'Selected Company - Admin' },
            { id: 'group-2', legalEntityId: 'le-2', displayName: 'Parsed Prefix - Buyer' },
          ],
        })}
      />,
    );

    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    expect(screen.getByText(/form\.userGroupForCompany.*"company":"Official GmbH"/)).toBeInTheDocument();
    expect(screen.queryByText(/form\.userGroupForCompany.*"company":"Parsed Prefix"/)).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Parsed Prefix - Buyer');
  });

  it('lists Contact-only first, then functional groups, and omits the Contact catalog row on create', async () => {
    mockFetchGroups.mockResolvedValueOnce(orderedAssignableGroups);
    render(<UserDetailsForm />);

    const contactOnly = await screen.findByRole('button', { name: 'form.contactOnly' });
    expect(contactOnly).toHaveAttribute('data-select-item', CONTACT_ONLY_GROUP_ID);
    const requestor = screen.getByRole('button', { name: 'Requestor' });
    const buyer = screen.getByRole('button', { name: 'Buyer' });
    const admin = screen.getByRole('button', { name: 'Admin' });
    expect(contactOnly.compareDocumentPosition(requestor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(requestor.compareDocumentPosition(buyer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buyer.compareDocumentPosition(admin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Contact$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'contact-group' })).not.toBeInTheDocument();
  });

  it('uses Unassign as the empty option for a selected-LE member and Select group otherwise', async () => {
    const { unmount } = render(
      <UserDetailsForm initialUser={buildInitialUser({ isSelectedLegalEntityMember: true })} />,
    );
    await screen.findByText('Selected Company - Admin');
    expect(screen.getByText('form.unassignFromCompany')).toBeInTheDocument();
    expect(
      screen
        .queryAllByRole('button', { name: 'form.groupPlaceholder' })
        .filter((element) => element.hasAttribute('data-select-item')),
    ).toHaveLength(0);
    unmount();

    render(
      <UserDetailsForm
        initialUser={buildInitialUser({
          isSelectedLegalEntityMember: false,
          groups: [{ id: 'group-2', legalEntityId: 'le-2', displayName: 'Other Company - Buyer' }],
        })}
      />,
    );
    await screen.findByLabelText(/form\.userGroupForCompany.*Selected Company/);
    expect(screen.getByText('form.groupPlaceholder')).toBeInTheDocument();
    expect(screen.queryByText('form.unassignFromCompany')).not.toBeInTheDocument();
  });

  it('shows Active user and keep-access hint when editing an active user', async () => {
    render(<UserDetailsForm initialUser={buildInitialUser({ active: true })} />);
    await screen.findByText('Selected Company - Admin');

    expect(screen.getByRole('checkbox', { name: 'form.activeUser' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'form.activateUser' })).not.toBeInTheDocument();
    fireEvent.pointerMove(screen.getByRole('checkbox', { name: 'form.activeUser' }), { pointerType: 'mouse' });
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('form.activeUserHelper');
  });
});

describe('buildOtherHeaderCompanyGroupSections', () => {
  const groups = [
    { id: 'g-selected', legalEntityId: 'le-1', displayName: 'NovaTech - Admin' },
    { id: 'g-req', legalEntityId: 'le-2', displayName: 'Emporix GmbH - Requester' },
    { id: 'g-contact', legalEntityId: 'le-2', displayName: 'Emporix GmbH - Contact' },
    { id: 'g-empty', legalEntityId: '   ', displayName: 'Skipped empty LE' },
    { id: 'g-unknown', legalEntityId: 'le-unknown', displayName: 'Unknown LE - Buyer' },
  ];

  it('follows headerCompanies order and keeps groups in returned order', () => {
    expect(
      buildOtherHeaderCompanyGroupSections(
        [
          { id: 'g-b1', legalEntityId: 'le-b', displayName: 'B-1' },
          { id: 'g-a1', legalEntityId: 'le-a', displayName: 'A-1' },
          { id: 'g-b2', legalEntityId: 'le-b', displayName: 'B-2' },
        ],
        [
          { id: 'le-selected', name: 'Selected' },
          { id: 'le-b', name: 'Beta' },
          { id: 'le-a', name: 'Alpha' },
        ],
        'le-selected',
      ),
    ).toEqual([
      {
        legalEntityId: 'le-b',
        companyName: 'Beta',
        groups: [
          { id: 'g-b1', displayName: 'B-1' },
          { id: 'g-b2', displayName: 'B-2' },
        ],
      },
      {
        legalEntityId: 'le-a',
        companyName: 'Alpha',
        groups: [{ id: 'g-a1', displayName: 'A-1' }],
      },
    ]);
  });

  it('omits the selected LE, empty legalEntityId, unknown LEs, and header LEs with no assignments', () => {
    expect(
      buildOtherHeaderCompanyGroupSections(
        groups,
        emporixHeaderCompanies.concat({ id: 'le-3', name: 'Empty Co' }),
        'le-1',
      ),
    ).toEqual([
      {
        legalEntityId: 'le-2',
        companyName: 'Emporix GmbH',
        groups: [
          { id: 'g-req', displayName: 'Emporix GmbH - Requester' },
          { id: 'g-contact', displayName: 'Emporix GmbH - Contact' },
        ],
      },
    ]);
  });

  it('returns no sections while the selected legal entity id is empty', () => {
    expect(buildOtherHeaderCompanyGroupSections(groups, emporixHeaderCompanies, '')).toEqual([]);
  });
});
