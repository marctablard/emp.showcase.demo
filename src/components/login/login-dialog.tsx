'use client';

import type { ReactNode } from 'react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoginForm } from './login-form';

type LoginDialogProps = {
  callbackUrl?: string;
  trigger?: ReactNode;
  email?: string;
  open?: boolean;
  onCloseAction?: () => void;
  guestCheckout?: boolean;
};

export default function LoginDialog({
  trigger,
  callbackUrl,
  email,
  open = false,
  onCloseAction,
  guestCheckout = false,
}: LoginDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onCloseAction?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-150">
        <VisuallyHidden>
          <DialogTitle />
          <DialogDescription />
        </VisuallyHidden>
        <LoginForm
          callbackUrl={callbackUrl}
          email={email}
          onSuccess={onCloseAction}
          guestCheckout={guestCheckout}
          isDialog
        />
      </DialogContent>
    </Dialog>
  );
}
