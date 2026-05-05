'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useL10n } from '@/hooks/useL10n';
import { fetchProductById } from '@/lib/client/products';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency, imageSizes } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

export interface CmsProductTileProps {
  sku: string;
  showPrice?: boolean;
  showRating?: boolean;
  className?: string;
}

/**
 * Shared CMS product tile. Fetches a product on mount via the same client API
 * the rest of the app uses (`fetchProductById` dedupes concurrent requests),
 * and renders three states:
 *  - **loading** — pulsing skeleton
 *  - **missing** — faded card with the raw SKU
 *  - **loaded** — image (`primaryImage` → `images[0]` → no-image fallback),
 *    localized name, and formatted price (with optional strikethrough on
 *    discounted items, mirroring `ProductTile`).
 */
export function CmsProductTile({ sku, showPrice = true, showRating = false, className }: CmsProductTileProps) {
  const t = useTranslations('product');
  const { l10n } = useL10n();
  // undefined = loading, null = not found / fetch failed
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  // Reset to the loading state when `sku` changes by tracking the previous
  // value and updating during render — see React docs, "Adjusting state on
  // prop change" — so we don't trigger a cascading render from inside an
  // effect.
  const [prevSku, setPrevSku] = useState(sku);
  if (sku !== prevSku) {
    setPrevSku(sku);
    setProduct(undefined);
  }

  useEffect(() => {
    let cancelled = false;
    fetchProductById(sku, { prices: true })
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((err) => {
        getLogger().error({ err, sku }, 'CmsProductTile: failed to fetch product');
        if (!cancelled) setProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sku]);

  if (product === undefined) {
    return (
      <Card className={cn('h-full', className)}>
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="bg-surface-image-background aspect-square w-full animate-pulse rounded-sm" aria-hidden />
          <span className="bg-surface-image-background h-4 w-3/4 animate-pulse rounded" aria-hidden />
          {showPrice ? (
            <span className="bg-surface-image-background h-4 w-1/3 animate-pulse rounded" aria-hidden />
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card className={cn('h-full opacity-50', className)}>
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="bg-surface-image-background aspect-square w-full rounded-sm" aria-hidden />
          <CardTitle className="text-base">{sku}</CardTitle>
          <span className="text-text-placeholders text-sm">{t('price.priceNotAvailable')}</span>
        </CardContent>
      </Card>
    );
  }

  const productName = l10n(product.name) || product.id;
  const image = product.primaryImage ?? product.images?.[0];

  return (
    <Link href={`/product/${product.id}`} className={cn('block h-full', className)}>
      <Card className="h-full transition hover:shadow-md">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="bg-surface-image-background relative aspect-square w-full overflow-hidden rounded-sm">
            {image?.url ? (
              <Image
                src={image.url}
                alt={image.altText ? l10n(image.altText) : productName}
                fill
                sizes={imageSizes}
                className="object-contain object-center p-2"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Image src="/images/no_image_alt.png" alt={productName} width={160} height={160} />
              </div>
            )}
          </div>
          <CardTitle className="line-clamp-2 text-base">{productName}</CardTitle>
          {showPrice ? (
            product.price ? (
              product.price.originalAmount && product.price.originalAmount !== product.price.amount ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-text-placeholders text-sm line-through">
                    {formatCurrency(product.price.originalAmount, product.price.currency)}
                  </span>
                  <span className="text-text-error text-base font-bold">
                    {formatCurrency(product.price.amount, product.price.currency)}
                  </span>
                </div>
              ) : (
                <span className="text-base font-bold">
                  {formatCurrency(product.price.amount, product.price.currency)}
                </span>
              )
            ) : (
              <span className="text-text-placeholders text-sm">{t('price.priceNotAvailable')}</span>
            )
          ) : null}
          {showRating ? <span className="text-text-placeholders text-sm">★★★★☆</span> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export default CmsProductTile;
