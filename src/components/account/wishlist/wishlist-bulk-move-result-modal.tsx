'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from '@/i18n/navigation';

export type WishlistBulkMoveResultMode = 'success' | 'warning';

interface WishlistBulkMoveResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: WishlistBulkMoveResultMode;
}

export function WishlistBulkMoveResultModal({ isOpen, onClose, mode }: WishlistBulkMoveResultModalProps) {
  const t = useTranslations('account.wishlist.bulkMoveResult');
  const tCommon = useTranslations('product.addToCartResult');
  const router = useRouter();

  const handleViewCart = () => {
    router.push('/cart');
    onClose();
  };

  const isSuccess = mode === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const iconColor = isSuccess ? 'text-icon-success' : 'text-icon-warning';
  const title = isSuccess ? t('success.title') : t('warning.title');
  const description = isSuccess ? t('success.description') : t('warning.description');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-3 py-4">
          <Icon className={`w-7 h-7 shrink-0 ${iconColor} mt-0.5`} aria-hidden="true" />
          <p className="text-lg">{description}</p>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon('continueShopping')}
          </Button>
          <Button onClick={handleViewCart}>{tCommon('viewCart')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
