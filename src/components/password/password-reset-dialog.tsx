'use client';

import type { ReactNode } from 'react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PasswordResetForm } from './password-reset-form';

type PasswordResetDialogProps = {
  trigger?: ReactNode;
  email?: string;
  open?: boolean;
  onCloseAction?: () => void;
  callbackUrl?: string;
};

export function PasswordResetDialog({
  trigger,
  email,
  open = false,
  onCloseAction,
  callbackUrl,
}: PasswordResetDialogProps) {
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
        <PasswordResetForm email={email} callbackUrl={callbackUrl} onSuccess={onCloseAction} isDialog />
      </DialogContent>
    </Dialog>
  );
}
