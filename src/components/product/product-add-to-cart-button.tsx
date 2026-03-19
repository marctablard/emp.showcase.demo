'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/cart/useCart';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import { ProductPrice } from '@/platform/services/model/price';
import { Product } from '@/platform/services/model/product';
import { AddToCartModal } from '../cart/add-to-cart-modal';
import { ToastType, notify } from '../ui/toast-notification';

export default function ProductAddToCartButton({
  product,
  price,
  quantity = 1,
  className,
}: {
  product: Product;
  price?: ProductPrice | null;
  quantity?: number;
  className?: string;
}) {
  const t = useTranslations('product');
  const { addItem, cart } = useCart();
  const [adding, setAdding] = useState(false);

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

  return (
    <>
      <Button
        className={cn('flex-1 w-full', className)}
        onClick={handleAddToCart}
        disabled={cart === undefined || product.purchasable === false || adding || !price}
        data-testid="product-addToCartButton"
      >
        {t('addToCart')}
        <ShoppingCart className="hidden sm:inline" />
      </Button>

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
