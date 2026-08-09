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
  const productImageAlt = product
    ? thumbnailAltSource?.altText
      ? l10nOrEmpty(thumbnailAltSource.altText) ||
        l10nOrEmpty(product.name) ||
        t('primaryImageAltUnlabeled', { id: product.id })
      : l10nOrEmpty(product.name) || t('primaryImageAltUnlabeled', { id: product.id })
    : undefined;

  return (
    <div
      data-pdp-sticky-overlay
      data-testid="product-add-to-cart-bar"
      className={cn('fixed top-0 left-0 right-0 mt-20 pt-4 z-50 max-w-6xl mx-auto hidden md:block', className)}
    >
      {/*
        Image is a full-height sibling (no py/padding) so it stays flush to the bar edge.
        Vertical padding lives only on the text/actions row so multi-line titles can grow the strip.
      */}
      <div className="bg-surface-action shadow-lg rounded-lg overflow-hidden relative flex items-stretch mx-4 md:mx-9 min-h-16">
        {product && showThumbnail ? (
          <div
            className="relative w-30 shrink-0 self-stretch bg-surface-image-background"
            data-testid="product-add-to-cart-bar-image"
          >
            <Image
              src={thumbnailUrl}
              alt={productImageAlt ?? ''}
              fill
              sizes="120px"
              className="object-cover object-center"
            />
          </div>
        ) : null}

        <div
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-4 py-2 pr-6',
            // Gap between flush image column and title (image itself has no padding)
            showThumbnail && 'pl-6',
          )}
        >
          {product ? (
            <div
              className={cn('flex min-w-0 items-center', !showThumbnail && 'pl-6')}
              data-testid="product-add-to-cart-bar-left"
            >
              <div
                className="min-w-0 text-sm leading-tight text-text-on-action font-headlines font-bold line-clamp-2"
                data-testid="product-add-to-cart-bar-name"
              >
                {l10n(product.name)}
              </div>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center p-1">
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
                      className="h-14 bg-surface-page text-text-action hover:bg-surface-page hover:text-text-action-hover"
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
    </div>
  );
}
