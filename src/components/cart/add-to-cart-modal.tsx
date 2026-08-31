'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { H3 } from '@/components/ui/h';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { PRODUCT_NO_IMAGE_SRC, resolveProductImageSrc } from '@/lib/common/product-image';
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
  const tProduct = useTranslations('product');
  const tSubstitution = useTranslations('cart');
  const { l10n } = useL10n();
  const router = useRouter();
  const imageSrc = resolveProductImageSrc(product.images?.[0]?.url);
  const imageAlt =
    imageSrc === PRODUCT_NO_IMAGE_SRC ? tProduct('noImage') : l10n(product.images?.[0]?.altText || product.name);

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
              <div className="flex h-[65px] w-[100px] items-center justify-center overflow-hidden rounded-ss-md rounded-ee-md">
                <Image
                  width={100}
                  height={65}
                  src={imageSrc}
                  alt={imageAlt}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{l10n(product?.brand?.name || '')}</p>
                    <p className="font-bold text-sm">{l10n(product?.name || '')}</p>
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
              <UINotification icon={Cog} iconSize={20} animate="spin" className="mr-4" />
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
