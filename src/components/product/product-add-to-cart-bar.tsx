import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FlipHorizontal2, Pin, Share2 } from 'lucide-react';
import { useProduct } from '@/hooks/product/useProduct';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import { ProductPrice } from '@/platform/services/model/price';
import { Product } from '@/platform/services/model/product';
import { Button } from '../ui/button';
import ProductAddToCartButton from './product-add-to-cart-button';
import { ProductPriceComponent } from './product-price';

export default function ProductAddToCartBar({
  product: initialProduct,
  price,
  className,
}: {
  product?: Product;
  price?: ProductPrice | null;
  className?: string;
}) {
  const { product } = useProduct(initialProduct);
  const locale = useLocale();
  const t = useTranslations('product');
  const { l10n } = useL10n(locale);
  return (
    <div className={cn('fixed top-0 left-0 right-0 mt-20 pt-4 z-50 max-w-6xl mx-auto hidden md:block', className)}>
      <div className="bg-surface-action shadow-lg rounded-lg overflow-hidden relative flex justify-between mx-4 md:mx-9 h-16">
        {product && (
          <div className="flex items-center gap-6">
            {product.images && product.images.length > 0 && (
              <div className="w-30 h-16 bg-surface-image-background p-2">
                <Image
                  src={product.images[0].url}
                  alt={product.images[0].altText ? l10n(product.images[0].altText) : `Product image`}
                  width="120"
                  height="64"
                  className="object-center w-full h-auto"
                />
              </div>
            )}
            <div className="text-text-on-action font-headlines font-bold">{l10n(product.name)}</div>
          </div>
        )}
        <div className="flex p-1 pr-6">
          <div className="flex">
            <div className="flex gap-10">
              <div className="text-text-on-action">
                {price && <ProductPriceComponent price={price} isAddToCartBar />}
              </div>
              {product && (
                <div className="px-6">
                  <ProductAddToCartButton
                    product={product}
                    price={price}
                    className="h-14 bg-surface-page text-text-action hover:bg-surface-page hover:text-text-action-hover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="icon" variant="primary" aria-label={t('compare')} className="border-white">
              <FlipHorizontal2 />
            </Button>
            <Button size="icon" variant="primary" aria-label={t('addToWishlist')} className="border-white">
              <Pin />
            </Button>
            <Button size="icon" variant="primary" aria-label={t('share')} className="border-white">
              <Share2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
