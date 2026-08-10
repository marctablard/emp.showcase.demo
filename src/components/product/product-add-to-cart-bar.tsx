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
      {/* Figma 2504:75394 — fixed 56px strip (h-14); thumbnail 120×56 with inset; title Desktop/heading/h5.
          Three in-flow flex siblings: image | middle (name + price) | actions.
          Middle: name min-w-0 flex-1 (may shrink/clamp); price shrink-0/w-max (always visible).
          Never put `@container` on the price — it collapses to 0 width under overflow-hidden. */}
      <div className="bg-surface-action shadow-lg rounded-lg overflow-hidden relative flex items-center mx-4 md:mx-9 h-14 pr-6">
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

        {product ? (
          <div
            className={cn('flex min-w-0 flex-1 items-center gap-6 overflow-hidden', showThumbnail ? 'ml-6' : 'pl-6')}
            data-testid="product-add-to-cart-bar-middle"
          >
            <div
              className="min-w-0 flex-1 line-clamp-2 text-3xl text-text-on-action font-headlines font-bold"
              data-testid="product-add-to-cart-bar-name"
            >
              {l10n(product.name)}
            </div>
            {/* Sibling of name — intrinsic width; never flex-1 / min-w-0 / @container. */}
            <div className="w-max shrink-0 text-text-on-action" data-testid="product-add-to-cart-bar-price">
              {price ? <ProductPriceComponent price={price} isAddToCartBar /> : null}
            </div>
          </div>
        ) : null}

        {/* Figma CTA Group `2504:75425` — button ↔ toolbar gap 24px; ml-10 ≈ Figma Price↔CTA gap-40.
            In normal flex flow after middle (shrink-0) — not absolute/right overlay. */}
        <div className="ml-10 flex shrink-0 items-center gap-6 p-1" data-testid="product-add-to-cart-bar-actions">
          {product ? (
            <ProductAddToCartButton
              product={product}
              price={price}
              className="h-12 bg-surface-page text-text-action hover:bg-surface-page hover:text-text-action-hover"
              availability={availability}
              availabilityLoading={availabilityLoading}
            />
          ) : null}
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
