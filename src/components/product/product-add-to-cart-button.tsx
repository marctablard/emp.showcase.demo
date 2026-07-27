'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useValidateAddToCart } from '@/hooks/cart/useValidateAddToCart';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import type { StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { AddToCartModal } from '../cart/add-to-cart-modal';
import { ToastType, notify } from '../ui/toast-notification';

export default function ProductAddToCartButton({
  product,
  price,
  quantity = 1,
  className,
  availability,
  availabilityLoading = false,
}: {
  product: Product;
  price?: ProductPrice | null;
  quantity?: number;
  className?: string;
  /** When set, block add while loading or when stock is not available for the current shop context. */
  availability?: StockAvailability | null;
  availabilityLoading?: boolean;
}) {
  const t = useTranslations('product');
  const { addItem, cart } = useCart();
  const { disabled: cartDisabled, tooltip: cartTooltip } = useValidateAddToCart(product, price);
  const { ready: syncReady, reason: syncReason } = useGlobalSyncReady();
  const [adding, setAdding] = useState(false);

  const isMidSwitch =
    !syncReady &&
    (syncReason === 'session-mutation' || syncReason === 'site-mismatch' || syncReason === 'cart-mismatch');
  const syncTitle = isMidSwitch ? t('updatingSite') : undefined;

  // State for the add-to-cart modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addToCartResult, setAddToCartResult] = useState<{
    status: CartStatus;
    statusDetailCode?: CartStatusDetailCode;
    statusDetailPayload?: any;
  } | null>(null);

  // No-op function for saving cart (to be implemented later)
  const handleSaveCart = () => {
    getLogger().debug({}, 'Save cart functionality will be implemented later');
    // This would be where we'd implement the saved cart functionality
  };

  const handleAddToCart = async () => {
    try {
      if (!product) return;
      setAdding(true);

      // Call addItem with the new return type
      const result = await addItem(product.id, quantity);

      // Set the result for the modal
      setAddToCartResult({
        status: result.status,
        statusDetailCode: result.statusDetailCode,
        statusDetailPayload: result.statusDetailPayload,
      });

      // Show the modal instead of a toast
      setIsModalOpen(true);
    } catch (error) {
      getLogger().error({ err: error }, 'Error adding to cart');
      notify({
        title: error instanceof Error ? error.message : String(error),
        type: ToastType.Error,
      });
    } finally {
      setAdding(false);
    }
  };

  const isDisabled =
    cart === undefined ||
    cartDisabled ||
    adding ||
    availabilityLoading ||
    (availability != null && !availability.isAvailable) ||
    !syncReady;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex flex-1 w-full">
            <Button
              className={cn('flex-1 w-full', className)}
              onClick={handleAddToCart}
              disabled={isDisabled}
              title={syncTitle}
              data-testid="product-addToCartButton"
            >
              {t('addToCart')}
              <ShoppingCart className="hidden sm:inline" />
            </Button>
          </span>
        </TooltipTrigger>
        {cartTooltip && <TooltipContent>{cartTooltip}</TooltipContent>}
      </Tooltip>

      {/* Add to Cart Modal */}
      {product && addToCartResult && (
        <AddToCartModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          status={addToCartResult.status}
          statusDetailCode={addToCartResult.statusDetailCode}
          statusDetailPayload={addToCartResult.statusDetailPayload}
          product={product}
          quantity={quantity}
          onSaveCart={handleSaveCart}
        />
      )}
    </>
  );
}
