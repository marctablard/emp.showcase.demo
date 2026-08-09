import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FlipHorizontal2, Pin, Share2 } from 'lucide-react';
import { useProduct } from '@/hooks/product/useProduct';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import type { StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { Button } from '../ui/button';
import ProductAddToCartButton from './product-add-to-cart-button';
import { ProductPriceComponent } from './product-price';

export default function ProductAddToCartBar({
  product: initialProduct,
  price,
  className,
  availability,
  availabilityLoading = false,
}: {
  product?: Product;
  price?: ProductPrice | null;
  className?: string;
  availability?: StockAvailability | null;
  availabilityLoading?: boolean;
}) {
  const { product } = useProduct(initialProduct);
  const locale = useLocale();
  const t = useTranslations('product');
  const { l10n, l10nOrEmpty } = useL10n(locale);

  // Only treat as shown when we have a non-empty URL — same gate as <Image> src.
  // Array length alone is not enough (empty string / whitespace URLs still left-flush the name).
  const thumbnailUrl = product?.images?.[0]?.url?.trim() || product?.primaryImage?.url?.trim() || '';
  const showThumbnail = Boolean(thumbnailUrl);
  const thumbnailAltSource = product?.images?.[0] ?? product?.primaryImage;
  let productImageAlt: string | undefined;
  if (product) {
    const fallbackAlt = l10nOrEmpty(product.name) || t('primaryImageAltUnlabeled', { id: product.id });
    productImageAlt = thumbnailAltSource?.altText
      ? l10nOrEmpty(thumbnailAltSource.altText) || fallbackAlt
      : fallbackAlt;
  }

  return (
    <div
      data-pdp-sticky-overlay
      data-testid="product-add-to-cart-bar"
      className={cn('fixed top-0 left-0 right-0 mt-20 pt-4 z-50 max-w-6xl mx-auto hidden md:block', className)}
    >
      {/* Figma 2504:75394 — fixed 56px strip (h-14); thumbnail 120×56 with inset; title Desktop/heading/h5 */}
      <div className="bg-surface-action shadow-lg rounded-lg overflow-hidden relative flex items-center justify-between mx-4 md:mx-9 h-14">
        {product && (
          <div
            className={cn('flex min-w-0 flex-1 items-center gap-6', !showThumbnail && 'pl-6')}
            data-testid="product-add-to-cart-bar-left"
          >
            {showThumbnail ? (
              <div
                className="w-30 h-14 shrink-0 bg-surface-image-background p-1.5"
                data-testid="product-add-to-cart-bar-image"
              >
                <Image
                  src={thumbnailUrl}
                  alt={productImageAlt ?? ''}
                  width={120}
                  height={56}
                  className="object-contain object-center w-full h-full"
                />
              </div>
            ) : null}
            <div
              className="min-w-0 truncate text-3xl text-text-on-action font-headlines font-bold"
              data-testid="product-add-to-cart-bar-name"
            >
              {l10n(product.name)}
            </div>
          </div>
        )}
        <div className="flex shrink-0 items-center p-1 pr-6">
          <div className="flex items-center">
            <div className="flex items-center gap-10">
              <div className="text-text-on-action">
                {price && <ProductPriceComponent price={price} isAddToCartBar />}
              </div>
              {product && (
                <div className="px-6">
                  <ProductAddToCartButton
                    product={product}
                    price={price}
                    className="h-12 bg-surface-page text-text-action hover:bg-surface-page hover:text-text-action-hover"
                    availability={availability}
                    availabilityLoading={availabilityLoading}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button size="icon" variant="primary" aria-label={t('compare')} className="border-surface-page">
              <FlipHorizontal2 />
            </Button>
            <Button size="icon" variant="primary" aria-label={t('addToWishlist')} className="border-surface-page">
              <Pin />
            </Button>
            <Button size="icon" variant="primary" aria-label={t('share')} className="border-surface-page">
              <Share2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
