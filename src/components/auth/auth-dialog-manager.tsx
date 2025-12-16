'use client';

import { PasswordResetDialog } from '@/components/password/password-reset-dialog';
import useAuthDialog from '@/hooks/authentication/useAuthDialog';
import { LoginDialog } from '../login';

/**
 * Component that manages authentication dialogs
 * Renders the appropriate dialog based on the active dialog state
 */
export default function AuthDialogManager() {
  const { activeDialog, closeDialog, openDialog, dialogOptions } = useAuthDialog();

  return (
    <>
      <LoginDialog
        open={activeDialog === 'login'}
        onCloseAction={closeDialog}
        onResetPasswordAction={(email) => openDialog('reset', { email })}
        callbackUrl={dialogOptions.callbackUrl}
        email={dialogOptions.email}
        guestCheckout={dialogOptions.guestCheckout}
      />
      <PasswordResetDialog
        open={activeDialog === 'reset'}
        onCloseAction={closeDialog}
        onBackToLoginAction={(email) => openDialog('login', { email })}
        email={dialogOptions.email}
      />
    </>
  );
}
