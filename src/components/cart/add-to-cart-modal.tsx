'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { CogIcon, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { H3 } from '@/components/ui/h';
import { useRouter } from '@/i18n/navigation';
import { l10n } from '@/lib/utils';
import type { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import type { Product } from '@/platform/services/model/product';
import UINotification from '../ui/molecules/ui-notification';

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CartStatus;
  statusDetailCode?: CartStatusDetailCode;
  statusDetailPayload?: any;
  product: Product;
  quantity: number;
  onSaveCart?: () => void;
}

export function AddToCartModal({
  isOpen,
  onClose,
  status,
  statusDetailCode,
  statusDetailPayload,
  product,
  quantity,
  onSaveCart,
}: AddToCartModalProps) {
  const t = useTranslations('product.addToCartResult');
  const tSubstitution = useTranslations('cart');
  const locale = useLocale();
  const router = useRouter();

  const handleViewCart = () => {
    router.push('/cart');
    onClose();
  };

  const handleContinueShopping = () => {
    onClose();
  };

  const handleSaveCart = () => {
    if (onSaveCart) {
      onSaveCart();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{status === 'OK' ? t('successTitle') : t('pendingTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 py-4">
          <div className="border-b pb-4">
            <H3 className="text-base font-medium mb-2">{t('productAdded')}</H3>
            <div className="flex items-center gap-4">
              {/* Product image */}
              <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] object-fit overflow-hidden">
                {product.images?.[0] ? (
                  <Image
                    width={100}
                    height={65}
                    src={product.images?.[0].url}
                    alt={l10n(product.images?.[0].altText || product.name, locale)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-icon-secondary bg-surface-image-background">
                    <ShoppingCart className="h-6 w-6 opacity-30" />
                  </div>
                )}
              </div>

              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{l10n(product?.brand?.name || '', locale)}</p>
                    <p className="font-bold text-sm">{l10n(product?.name || '', locale)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  {status === 'PENDING' && statusDetailCode === 'addToCart.insufficientStock' ? (
                    <p className="text-sm font-bold pr-4 text-text-warning">
                      <span className="">
                        {tSubstitution('substitution.availableDescription', {
                          available: statusDetailPayload?.availableQuantity,
                          total: quantity,
                        })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm font-bold pr-4 text-text-success">
                      <span className="">
                        {t('quantityAdded')} {quantity}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {status === 'PENDING' && statusDetailCode === 'addToCart.insufficientStock' && (
            <div className="flex items-center justify-between">
              <UINotification icon={CogIcon} iconSize={20} animate="spin" className="mr-4" />
              <p className="text-sm font-bold pr-4">
                <span className="">{t('insufficientStockMessage')}</span>
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleContinueShopping}>
              {t('continueShopping')}
            </Button>
            <Button onClick={handleViewCart}>{t('viewCart')}</Button>
          </div>
          {/* Add when SaveCart is properly tested */}
          {false && status === 'PENDING' && (
            <div className="col-span-1">
              <Button variant="secondary" onClick={handleSaveCart} className="w-full">
                {t('saveCart')}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
