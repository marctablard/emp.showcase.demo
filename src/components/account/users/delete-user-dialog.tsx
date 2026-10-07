'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useAuthentication } from '@/hooks/authentication/useAuthentication';
import { useSession } from '@/hooks/session/useSession';
import { deleteCompanyUser } from '@/lib/client/user-management';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';

function companyUserDisplayName(user: CompanyUser): string {
  const name = [user.firstName.trim(), user.lastName.trim()].filter((part) => part.length > 0).join(' ');
  return name || user.id;
}

export interface DeleteUserDialogProps {
  user: CompanyUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (user: CompanyUser) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange, onDeleted }: Readonly<DeleteUserDialogProps>) {
  const t = useTranslations('user-management');
  const { session } = useSession();
  const { logout } = useAuthentication();
  const [pending, setPending] = useState(false);
  const displayName = user ? companyUserDisplayName(user) : '';
  const sessionCustomerId = session?.customerId;
  const isSelfDelete =
    user != null && isAuthenticatedSessionCustomerId(sessionCustomerId) && user.id === sessionCustomerId;

  const handleCancel = () => {
    if (pending) return;
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!user || pending) return;
    setPending(true);
    try {
      await deleteCompanyUser(user.id);
      notify({
        title: t('notifications.deleteSuccess'),
        type: ToastType.Success,
        duration: 4000,
      });
      if (isSelfDelete) {
        await logout();
        return;
      }
      onDeleted(user);
      onOpenChange(false);
    } catch {
      notify({
        title: t('notifications.genericFailure'),
        type: ToastType.Error,
        duration: 4000,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return;
        onOpenChange(nextOpen);
      }}
      title={t('deleteDialog.title')}
      description={
        isSelfDelete ? t('deleteDialog.descriptionSelf') : t('deleteDialog.description', { name: displayName })
      }
      cancelLabel={t('deleteDialog.cancel')}
      confirmLabel={t('deleteDialog.confirm')}
      onCancel={handleCancel}
      onConfirm={() => {
        handleConfirm().catch(() => undefined);
      }}
      pending={pending}
    />
  );
}
