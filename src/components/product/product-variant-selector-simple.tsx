'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSession } from '@/hooks/session/useSession';
import { useL10n } from '@/hooks/useL10n';
import { type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import { useRouter } from '@/i18n/navigation';
import { fetchProductPrice } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import { cn, formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { Skeleton } from '../ui/skeleton';

export interface ProductVariantSelectorSimpleProps {
  product: Product;
  soloVariant: NonNullable<Product['variantAttributes']>[0];
  className?: string;
}

export default function ProductVariantSelectorSimple({
  product,
  soloVariant,
  className,
}: ProductVariantSelectorSimpleProps) {
  const [variants, setVariants] = useState<Product[]>([]);
  const [variantPrices, setVariantPrices] = useState<ProductPrice[] | undefined>(undefined);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(product.id);

  const router = useRouter();
  const t = useTranslations('product');
  const { l10n } = useL10n();
  const { session } = useSession();

  // Reset variant prices when currency changes to trigger re-fetch
  useEffect(() => {
    if (session?.currency && variantPrices !== undefined && variants.length > 0) {
      setVariantPrices(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currency]);

  useEffect(() => {
    let isCancelled = false;

    const loadVariantsAndPrices = async () => {
      if (isCancelled) {
        return;
      }

      try {
        // Only reset prices if variants are already loaded (currency change case)
        if (variants.length === 0) {
          setVariantPrices(undefined);

          const fetchedVariants = await fetchProductVariants(product.parentVariantId || product.id);

          if (isCancelled) {
            return;
          }

          setVariants(fetchedVariants);

          if (!soloVariant || fetchedVariants.length === 0) {
            return;
          }

          const fetchedPrices = await Promise.all(fetchedVariants.map((variant) => fetchProductPrice(variant.id)));

          if (isCancelled) {
            return;
          }

          setVariantPrices(fetchedPrices.filter((price): price is ProductPrice => price !== null));
        } else if (variantPrices === undefined) {
          // Re-fetch only prices when currency changes (variants already loaded)
          const fetchedPrices = await Promise.all(variants.map((variant) => fetchProductPrice(variant.id)));

          if (isCancelled) {
            return;
          }

          setVariantPrices(fetchedPrices.filter((price): price is ProductPrice => price !== null));
        }
      } catch {
        if (isCancelled) {
          return;
        }

        setVariants([]);
        setVariantPrices(undefined);
      }
    };

    void loadVariantsAndPrices();

    return () => {
      isCancelled = true;
    };
  }, [product.id, product.parentVariantId, soloVariant, variants, variantPrices]);

  // Handle variant selection via tiles
  const handleVariantTileClick = (variant: Product) => {
    setSelectedVariant(variant.id);
    startTransition(() => {
      router.push(`/product/${variant.id}`);
    });
  };

  const getPrice = (variant: Product) => {
    return variantPrices && variantPrices.find((price) => price.productId === variant.id);
  };

  // Show loading skeleton cards while variants are being fetched
  if (variants.length === 0) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-6', className)}>
        {Array.from({ length: soloVariant.values?.length || 0 }, (_, index) => (
          <Card
            key={`skeleton-${index}`}
            variant="gray"
            className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-2 lg:grid-cols-3 border border-border-primary"
          >
            <div className="col-start-1 p-4">
              <div className="w-[108px] h-[68px]">
                <Skeleton className="w-full h-full" />
              </div>
            </div>
            <div className="col-start-2 p-6 flex flex-col justify-center gap-2">
              <div className="flex gap-2 items-center text-text-placeholders">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex gap-2 items-center font-bold">
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-6', className)}>
      {variants.map((variant) => {
        const isSelected = variant.id === selectedVariant;
        const variantValue = variant.variantAttributes?.[0].values?.find((value) => value.selected)?.key || variant.id;
        return (
          <Card
            key={variant.id}
            variant={isSelected ? 'primary' : 'gray'}
            className={cn(
              'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-2 lg:grid-cols-3',
              isSelected ? 'border border-border-action' : 'border border-border-primary',
            )}
            onClick={() => handleVariantTileClick(variant)}
          >
            <div className="col-start-1 p-4">
              <div className="w-[108px] h-[68px] bg-surface-image-background">
                {variant.images && variant.images.length > 0 ? (
                  <Image
                    src={variant.images[0].url}
                    alt={variant.images[0].altText ? l10n(variant.images[0].altText) : `Product image`}
                    width={100}
                    height={50}
                    className="object-center w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm text-text-on-disabled">No image</span>
                  </div>
                )}
              </div>
            </div>
            <div className="col-start-2 p-6 flex flex-col justify-center">
              <div className="flex gap-2 items-center text-text-placeholders">
                <p>
                  {soloVariant.name
                    ? l10n(soloVariant.name)
                    : t(dk<ProductVariantAttributeKey>(`filters.mixins.productVariantAttributes.${soloVariant?.key}`), {
                        defaultValue: soloVariant?.key,
                      })}
                </p>
              </div>
              <div className="flex gap-2 items-center font-bold">
                <p>{variantValue ? l10n(variantValue) : variantValue}</p>
                {isSelected && <CheckCircle2 className="text-text-success w-4 h-4" />}
              </div>
              {variantPrices ? (
                <p className="text-sm text-text-on-disabled">
                  {getPrice(variant) ? (
                    formatCurrency(getPrice(variant)?.amount || 0, getPrice(variant)?.currency)
                  ) : (
                    <span className="h-4 w-20">N/A</span>
                  )}
                </p>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
