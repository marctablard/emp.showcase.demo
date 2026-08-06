'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ButtonVariant = ComponentProps<typeof Button>['variant'];

export type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  confirmVariant?: ButtonVariant;
};

/**
 * Shared confirmation Dialog (Approval decline / Order Cancel / Approval Accept pattern).
 * Escape and outside dismiss close the dialog without confirming; pending blocks dismiss and disables actions.
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  pending = false,
  confirmVariant = 'outlineError',
}: Readonly<ConfirmationDialogProps>) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    // Ignore dismiss attempts (Escape/outside click/close button) while the mutation is pending.
    if (pending) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
