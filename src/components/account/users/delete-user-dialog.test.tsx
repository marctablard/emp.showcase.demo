/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { DeleteUserDialog } from './delete-user-dialog';

const mockDeleteCompanyUser = jest.fn();
const mockNotify = jest.fn();
const mockLogout = jest.fn();
const mockUseSession = jest.fn();

const SESSION_CUSTOMER_ID = '00632699';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values && 'name' in values ? `${key}:${values.name}` : key,
}));

jest.mock('@/lib/client/user-management', () => ({
  deleteCompanyUser: (...args: unknown[]) => mockDeleteCompanyUser(...args),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Success: 'success', Error: 'error' },
  notify: (...args: unknown[]) => mockNotify(...args),
}));

jest.mock('@/hooks/authentication/useAuthentication', () => ({
  useAuthentication: () => ({ logout: (...args: unknown[]) => mockLogout(...args) }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

function authenticatedSession(customerId = SESSION_CUSTOMER_ID) {
  return { session: { customerId } };
}

function buildUser(overrides: Partial<CompanyUser> = {}): CompanyUser {
  return {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Smith',
    contactEmail: 'j.smith@mail.com',
    active: true,
    createdAt: '2024-12-17T10:00:00.000Z',
    groups: [],
    ...overrides,
  };
}

describe('DeleteUserDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue(authenticatedSession());
    mockLogout.mockResolvedValue(undefined);
  });

  it('interpolates Q29 delete copy with the user name', () => {
    render(<DeleteUserDialog user={buildUser()} open onOpenChange={jest.fn()} onDeleted={jest.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('deleteDialog.description:John Smith')).toBeInTheDocument();
    expect(screen.queryByText('deleteDialog.descriptionSelf')).not.toBeInTheDocument();
    expect(screen.queryByText(/This user will be removed/)).not.toBeInTheDocument();
  });

  it('uses descriptionSelf for the authenticated session customer and does not interpolate the display name', () => {
    const user = buildUser({ id: SESSION_CUSTOMER_ID, firstName: 'Pat', lastName: 'Admin' });
    render(<DeleteUserDialog user={user} open onOpenChange={jest.fn()} onDeleted={jest.fn()} />);

    expect(screen.getByText('deleteDialog.descriptionSelf')).toBeInTheDocument();
    expect(screen.queryByText('deleteDialog.description:Pat Admin')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pat Admin/)).not.toBeInTheDocument();
  });

  it('calls delete on confirm and does not delete on cancel', async () => {
    mockDeleteCompanyUser.mockResolvedValue(undefined);
    const onOpenChange = jest.fn();
    const onDeleted = jest.fn();
    const user = buildUser();
    render(<DeleteUserDialog user={user} open onOpenChange={onOpenChange} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.cancel' }));
    expect(mockDeleteCompanyUser).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() => expect(mockDeleteCompanyUser).toHaveBeenCalledWith('user-1'));
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'notifications.deleteSuccess', type: 'success', duration: 4000 }),
    );
    expect(onDeleted).toHaveBeenCalledWith(user);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('calls logout after a successful self-delete and skips list refresh', async () => {
    mockDeleteCompanyUser.mockResolvedValue(undefined);
    const onOpenChange = jest.fn();
    const onDeleted = jest.fn();
    const user = buildUser({ id: SESSION_CUSTOMER_ID });
    render(<DeleteUserDialog user={user} open onOpenChange={onOpenChange} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() => expect(mockDeleteCompanyUser).toHaveBeenCalledWith(SESSION_CUSTOMER_ID));
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'notifications.deleteSuccess', type: 'success', duration: 4000 }),
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not logout when self-delete fails', async () => {
    mockDeleteCompanyUser.mockRejectedValue(new Error('boom'));
    const onOpenChange = jest.fn();
    const onDeleted = jest.fn();
    const user = buildUser({ id: SESSION_CUSTOMER_ID });
    render(<DeleteUserDialog user={user} open onOpenChange={onOpenChange} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'notifications.genericFailure', type: 'error', duration: 4000 }),
      ),
    );
    expect(mockLogout).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not logout after a successful other-user delete', async () => {
    mockDeleteCompanyUser.mockResolvedValue(undefined);
    const onDeleted = jest.fn();
    const user = buildUser();
    render(<DeleteUserDialog user={user} open onOpenChange={jest.fn()} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(user));
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('notifies on delete failure and stays open', async () => {
    mockDeleteCompanyUser.mockRejectedValue(new Error('boom'));
    const onOpenChange = jest.fn();
    const onDeleted = jest.fn();
    render(<DeleteUserDialog user={buildUser()} open onOpenChange={onOpenChange} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'notifications.genericFailure', type: 'error', duration: 4000 }),
      ),
    );
    expect(onDeleted).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
