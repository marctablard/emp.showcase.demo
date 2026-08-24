/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { DeleteUserDialog } from './delete-user-dialog';

const mockDeleteCompanyUser = jest.fn();
const mockNotify = jest.fn();

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
  });

  it('interpolates Q29 delete copy with the user name', () => {
    render(<DeleteUserDialog user={buildUser()} open onOpenChange={jest.fn()} onDeleted={jest.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('deleteDialog.description:John Smith')).toBeInTheDocument();
    expect(screen.queryByText(/This user will be removed/)).not.toBeInTheDocument();
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
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
