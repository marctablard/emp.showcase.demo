'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/hooks/cart/useCart';
import { useL10n } from '@/hooks/useL10n';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { CartItem, CartItemPriceChange } from '@/platform/services/model/cart/cart.d';

interface ItemPriceChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItem: CartItem;
  priceChange: CartItemPriceChange;
  onDone: () => void;
}

export function ItemPriceChangeModal({ isOpen, onClose, cartItem, priceChange, onDone }: ItemPriceChangeModalProps) {
  const t = useTranslations('cart');
  const { l10n } = useL10n();
  const { removeItem, loading } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle confirming the price change
  const handleConfirm = () => {
    onDone();
  };

  // Handle removing the item from cart
  const handleRemoveItem = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      await removeItem(cartItem.id);
      onDone();
    } catch (error) {
      getLogger().error({ err: error }, 'Error removing item from cart');
    } finally {
      setIsProcessing(false);
    }
  };

  const priceDifference = priceChange.newPrice - priceChange.oldPrice;
  const isIncrease = priceDifference > 0;
  const formattedDifference = `${isIncrease ? '+' : ''}${formatCurrency(priceDifference, cartItem.price.currency)}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('priceChange.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          {/* Product information */}
          <div className="border-b pb-4">
            <div className="flex items-center gap-4">
              <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] object-fit overflow-hidden">
                {cartItem.product && cartItem.product.images?.length ? (
                  <Image
                    width={100}
                    height={65}
                    src={String(cartItem.product.images[0].url)}
                    alt={String(cartItem.product.name || 'Product')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-icon-secondary">
                    <ShoppingCart className="h-6 w-6 opacity-30" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{l10n(cartItem.product?.brand?.name || '')}</p>
                    <p className="font-bold">{l10n(cartItem.product?.name || 'Product')}</p>
                    <p className="text-sm text-text-placeholders pr-4">
                      {t('itemNumber')}: {cartItem.product?.id}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price change information */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm mb-2">{t('priceChange.description')}</p>

              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm">{t('priceChange.oldPrice')}</p>
                  <p className="font-bold line-through text-text-placeholders">
                    {formatCurrency(priceChange.oldPrice, cartItem.price.currency)}
                  </p>
                </div>
                <div className="text-2xl">→</div>
                <div className="text-center">
                  <p className="text-sm">{t('priceChange.newPrice')}</p>
                  <p className="font-bold text-lg">{formatCurrency(priceChange.newPrice, cartItem.price.currency)}</p>
                </div>
              </div>

              <div className={`text-sm font-medium ${isIncrease ? 'text-text-error' : 'text-text-success'}`}>
                {isIncrease ? t('priceChange.priceIncrease') : t('priceChange.priceDecrease')}: {formattedDifference}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 gap-3">
          <Button className="w-full" onClick={handleConfirm} disabled={isProcessing || loading}>
            {t('priceChange.confirm')}
          </Button>
          <UiLink
            type="Button"
            onClick={handleRemoveItem}
            disabled={isProcessing || loading}
            className="flex justify-center"
          >
            {isProcessing || loading ? <Spinner color="white" variant="xs" /> : t('priceChange.removeFromCart')}
          </UiLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemPriceChangeModal;
