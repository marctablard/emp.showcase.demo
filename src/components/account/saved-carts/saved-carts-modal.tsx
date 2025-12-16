'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SavedCartsList } from './saved-carts-list';

interface SavedCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedCartsModal({ isOpen, onClose }: SavedCartsModalProps) {
  const t = useTranslations('savedCarts');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <SavedCartsList isModal onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
