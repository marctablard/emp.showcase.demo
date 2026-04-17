'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useProduct } from '@/hooks/product/useProduct';
import { cn } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import ProductAddToCartButton from './product-add-to-cart-button';

// Client component that uses the product signal
export default function ProductAddToCart({
  product: initialProduct,
  price,
  className,
}: {
  product?: Product;
  price?: ProductPrice | null;
  className?: string;
}) {
  const t = useTranslations('product');
  const { product, loading: productLoading, error: productError } = useProduct(initialProduct);
  const [quantity, setQuantity] = useState(1);

  if (productLoading) {
    return (
      <div className={cn('flex items-center justify-center p-6 space-x-2', className)}>
        <Spinner color="primary" variant="sm" />
        <span className="text-text-placeholders">Loading...</span>
      </div>
    );
  }

  if (productError) {
    return (
      <div className={cn('p-4 border border-border-error rounded-md bg-surface-error text-text-error', className)}>
        <p className="text-sm font-medium">Error loading product: {productError.message}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={cn('p-4 border rounded-md bg-surface-disabled/50 text-text-placeholders', className)}>
        <p className="text-sm">Product not found</p>
      </div>
    );
  }

  const incrementQuantity = () => {
    setQuantity(quantity + 1);
  };

  const decrementQuantity = () => {
    setQuantity(Math.max(quantity - 1, 1));
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full">
      <div className="flex items-center sm:w-auto sm:flex-shrink-0">
        <Button
          variant="secondary"
          size="icon"
          className="p-3 h-13 border-e-0 border-border-primary rounded-none rounded-ss-sm rounded-es-sm disabled:border-border-primary transition duration-200 ease-in-out"
          onClick={decrementQuantity}
          aria-label={t('decrement')}
          disabled={quantity <= 1}
          data-testid="product-quantity-decrement"
        >
          <Minus />
        </Button>
        <Input
          id="quantity"
          type="number"
          min="1"
          max="999"
          aria-label={t('quantity')}
          className="text-center min-w-[14] w-full h-13 border border-border-primary rounded-none sm:[appearance:textfield] sm:[&::-webkit-outer-spin-button]:appearance-none sm:[&::-webkit-inner-spin-button]:appearance-none"
          value={quantity}
          onChange={handleQuantityChange}
          data-testid="product-quantity"
        />
        <Button
          variant="secondary"
          size="icon"
          className="p-3 h-13 border-s-0 border-border-primary rounded-none rounded-ee-sm rounded-se-sm disabled:border-border-primary transition duration-200 ease-in-out"
          aria-label={t('increment')}
          onClick={incrementQuantity}
          data-testid="product-quantity-increment"
        >
          <Plus />
        </Button>
      </div>
      <ProductAddToCartButton
        product={product}
        price={price}
        quantity={quantity}
        className="flex-1 w-full h-[52px] mt-4 sm:mt-0 sm:flex-grow"
      />
    </div>
  );
}
