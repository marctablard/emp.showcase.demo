'use client';

import React, { startTransition, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { fetchProductPrice } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import { cn, formatCurrency } from '@/lib/utils';
import { ProductPrice } from '@/platform/services/model/price';
import { Product } from '@/platform/services/model/product';
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

  const getVariants = useCallback(async () => {
    const variants = await fetchProductVariants(product.parentVariantId || product.id);
    setVariants(variants);
  }, [product]);

  const getPrices = useCallback(async () => {
    const prices = await Promise.all(variants.map((variant) => fetchProductPrice(variant.id)));
    setVariantPrices(prices.filter((price) => price !== null) as ProductPrice[]);
  }, [variants]);

  useEffect(() => {
    getVariants();
  }, [product, getVariants]);

  useEffect(() => {
    if (variants.length > 0 && soloVariant) {
      getPrices();
    }
  }, [variants, getPrices, soloVariant]);

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
      <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6', className)}>
        {Array.from({ length: soloVariant.values?.length || 0 }, (_, index) => (
          <Card
            key={`skeleton-${index}`}
            variant="gray"
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-2 2xl:grid-cols-3 rounded-sm border-2 border-neutral-50"
          >
            <div className="col-start-1 p-4">
              <div className="w-[108px] h-[68px]">
                <Skeleton className="w-full h-full" />
              </div>
            </div>
            <div className="col-start-2 p-6 flex flex-col justify-center gap-2">
              <div className="flex gap-2 items-center text-muted-foreground">
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
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6', className)}>
      {variants.map((variant) => {
        const isSelected = variant.id === selectedVariant;
        const variantValue = variant.variantAttributes?.[0].values?.find((value) => value.selected)?.key || variant.id;
        return (
          <Card
            key={variant.id}
            variant={isSelected ? 'primary' : 'gray'}
            className={cn(
              'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-2 2xl:grid-cols-3 rounded-sm',
              isSelected ? 'border-2 border-primary-500' : 'border-2 border-neutral-50',
            )}
            onClick={() => handleVariantTileClick(variant)}
          >
            <div className="col-start-1 p-4">
              <div className="w-[108px] h-[68px]">
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
                    <span className="text-xs text-neutral-600">No image</span>
                  </div>
                )}
              </div>
            </div>
            <div className="col-start-2 p-6 flex flex-col justify-center">
              <div className="flex gap-2 items-center text-muted-foreground">
                <p>
                  {soloVariant.name
                    ? l10n(soloVariant.name)
                    : t(`filters.mixins.productVariantAttributes.${soloVariant?.key}`, {
                        defaultValue: soloVariant?.key,
                      })}
                </p>
              </div>
              <div className="flex gap-2 items-center font-bold">
                <p>{variantValue ? l10n(variantValue) : variantValue}</p>
                {isSelected && <CheckCircle2 className="text-success-500 w-4 h-4" />}
              </div>
              {variantPrices ? (
                <p className="text-xs text-neutral-600">
                  {getPrice(variant) ? (
                    formatCurrency(getPrice(variant)?.amount || 0, getPrice(variant)?.currency || 'EUR')
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
