'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/cart/useCart';
import { useL10n } from '@/hooks/useL10n';
import { Link } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import { Product } from '@/platform/services/model/product';
import { ToastType, notify } from '../ui/toast-notification';

interface RelatedMaterialItemProps {
  product: Product;
  locale: string;
  relationType?: string;
}

export function RelatedMaterialItem({ product, locale, relationType }: RelatedMaterialItemProps) {
  const t = useTranslations('product');
  const tRelated = useTranslations('product.relatedMaterials');
  const { l10n } = useL10n(locale);
  const { addItem, loading: cartLoading } = useCart();
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async (e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      e.preventDefault();

      if (!product) return;

      await addItem(product.id, quantity);

      notify({
        title: `${l10n(product.name)} ${t('addedToCartDescription')}`,
        type: ToastType.Success,
      });
    } catch (error) {
      getLogger().error({ err: error }, 'Error adding to cart');
      notify({
        title: error instanceof Error ? error.message : String(error),
        type: ToastType.Error,
      });
    }
  };

  const incrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuantity((prev) => prev + 1);
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  };

  const formatPrice = (price?: { amount?: number; currency?: string } | null) => {
    if (!price || !price.amount) return t('price.notAvailable');
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: price.currency || 'EUR',
    }).format(price.amount);
  };

  return (
    <Link href={`/product/${product.id}`} className="block">
      <div className="flex items-center gap-4 p-4 border border-border-primary rounded-sm transition hover:bg-surface-hover hover:shadow-sm">
        {/* Product Image */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-surface-image-background">
          {product.images && product.images.length > 0 ? (
            <Image
              src={product.images[0].url}
              alt={product.images[0].altText ? l10n(product.images[0].altText) : l10n(product.name)}
              fill
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Image src="/images/no_image_alt.png" alt={l10n(product.name)} width={40} height={40} />
            </div>
          )}
        </div>

        {/* Product Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2 text-text-headings">{l10n(product.name)}</p>
        </div>

        {/* Relation Type */}
        <div className="w-32 flex-shrink-0 hidden sm:block">
          {relationType && (
            <p className="text-sm text-text-body">
              {tRelated(`types.${relationType.toLowerCase()}` as Parameters<typeof tRelated>[0])}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="w-24 flex-shrink-0 hidden md:block">
          <p className="text-sm font-medium text-text-headings">{formatPrice(product.price)}</p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center border border-border-primary rounded-sm flex-shrink-0">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-none border-none"
            onClick={decrementQuantity}
            disabled={quantity <= 1}
            aria-label={t('decrement')}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={handleQuantityChange}
            onClick={(e) => e.stopPropagation()}
            className="h-10 w-16 border-0 border-x border-border-primary rounded-none text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={t('quantity')}
          />
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-none border-none"
            onClick={incrementQuantity}
            aria-label={t('increment')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Add to Cart Button */}
        <Button
          variant="primary"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={handleAddToCart}
          disabled={cartLoading || !product.purchasable}
          aria-label={t('addToCart')}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  );
}
