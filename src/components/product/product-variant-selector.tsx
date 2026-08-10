'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/hooks/session/useSession';
import { fetchProductPrices } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import {
  collectVariantAttributeGroups,
  getCompatibleValuesByAttribute,
  getSelectedVariantAttributeValues,
} from '@/lib/common/product-variant-attributes';
import { cn } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { Skeleton } from '../ui/skeleton';
import { ProductVariantAttributeGroups } from './product-variant-attribute-groups';
import { ProductVariantCarousel } from './product-variant-carousel';

export interface ProductVariantSelectorProps {
  product: Product;
  price?: ProductPrice | null;
  className?: string;
}

/**
 * PDP variant area: attribute-value chips (display-only) + sellable-variants carousel.
 * Replaces the previous simple card grid / multi dropdowns (Figma `12799:113082` + `12799:113107`).
 */
export default function ProductVariantSelector({ product, className }: ProductVariantSelectorProps) {
  const [variants, setVariants] = useState<Product[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantPrices, setVariantPrices] = useState<ProductPrice[] | undefined>(undefined);
  const { session } = useSession();

  const parentId = product.parentVariantId || product.id;
  const [prevParentId, setPrevParentId] = useState(parentId);
  if (prevParentId !== parentId) {
    setPrevParentId(parentId);
    setVariants([]);
    setVariantsLoaded(false);
    setVariantPrices(undefined);
  }

  const sessionCurrency = session?.currency;
  const [prevSessionCurrency, setPrevSessionCurrency] = useState(sessionCurrency);
  if (prevSessionCurrency !== sessionCurrency) {
    setPrevSessionCurrency(sessionCurrency);
    if (sessionCurrency && variantPrices !== undefined && variantsLoaded) {
      setVariantPrices(undefined);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    const loadVariantsAndPrices = async (): Promise<void> => {
      if (isCancelled) {
        return;
      }

      try {
        if (!variantsLoaded) {
          setVariantPrices(undefined);
          const fetchedVariants = await fetchProductVariants(parentId);
          if (isCancelled) {
            return;
          }
          setVariants(fetchedVariants);
          setVariantsLoaded(true);
          if (fetchedVariants.length === 0) {
            setVariantPrices([]);
            return;
          }
          const priceMap = await fetchProductPrices(
            fetchedVariants.map((variant) => variant.id),
            session?.currency,
          );
          if (isCancelled) {
            return;
          }
          setVariantPrices(Object.values(priceMap).filter((price): price is ProductPrice => price !== null));
          return;
        }

        if (variantPrices === undefined && variants.length > 0) {
          const priceMap = await fetchProductPrices(
            variants.map((variant) => variant.id),
            session?.currency,
          );
          if (isCancelled) {
            return;
          }
          setVariantPrices(Object.values(priceMap).filter((price): price is ProductPrice => price !== null));
        }
      } catch {
        if (isCancelled) {
          return;
        }
        setVariants([]);
        setVariantsLoaded(true);
        setVariantPrices([]);
      }
    };

    void loadVariantsAndPrices();

    return () => {
      isCancelled = true;
    };
  }, [parentId, variants, variantsLoaded, variantPrices, session?.currency]);

  const attributeGroups = useMemo(() => collectVariantAttributeGroups(product, variants), [product, variants]);
  const attributeOrder = useMemo(() => attributeGroups.map((group) => group.key), [attributeGroups]);
  const selectedAttributeValues = useMemo(() => getSelectedVariantAttributeValues(product), [product]);
  const compatibleValuesByAttribute = useMemo(
    () => getCompatibleValuesByAttribute(variants, selectedAttributeValues, attributeOrder),
    [variants, selectedAttributeValues, attributeOrder],
  );

  if (!product.variantAttributes || product.variantAttributes.length === 0) {
    return null;
  }

  if (!variantsLoaded) {
    return (
      <div className={cn('flex flex-col gap-6', className)} data-testid="product-variant-selector-loading">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (variants.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex min-w-0 w-full flex-col gap-8', className)} data-testid="product-variant-selector">
      <ProductVariantAttributeGroups
        groups={attributeGroups}
        selectedValues={selectedAttributeValues}
        compatibleValuesByAttribute={compatibleValuesByAttribute}
      />
      <ProductVariantCarousel
        variants={variants}
        prices={variantPrices ?? []}
        currentProductId={product.id}
        attributeOrder={attributeOrder}
      />
    </div>
  );
}
