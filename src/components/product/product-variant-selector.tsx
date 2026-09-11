'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClientFetchScope } from '@/hooks/common/useClientFetchScope';
import { useSession } from '@/hooks/session/useSession';
import { fetchProductPrices } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import {
  collectVariantAttributeGroups,
  getCompatibleValuesByAttribute,
  getSelectedVariantAttributeValues,
  isVariantFamilyProduct,
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
  const clientDedupeScope = useClientFetchScope();

  const parentId = product.parentVariantId || product.id;
  const shouldLoadVariants = isVariantFamilyProduct(product);
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
    if (!shouldLoadVariants) {
      return;
    }

    let isCancelled = false;

    const loadVariants = async (): Promise<void> => {
      try {
        const fetchedVariants = await fetchProductVariants(parentId, clientDedupeScope);
        if (isCancelled) {
          return;
        }
        setVariants(fetchedVariants);
        setVariantsLoaded(true);
        if (fetchedVariants.length === 0) {
          setVariantPrices([]);
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

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [parentId, shouldLoadVariants, clientDedupeScope]);

  useEffect(() => {
    if (!variantsLoaded || variants.length === 0) {
      return;
    }

    let isCancelled = false;

    const loadPrices = async (): Promise<void> => {
      try {
        const priceMap = await fetchProductPrices(
          variants.map((variant) => variant.id),
          sessionCurrency,
        );
        if (isCancelled) {
          return;
        }
        setVariantPrices(Object.values(priceMap).filter((price): price is ProductPrice => price !== null));
      } catch {
        if (isCancelled) {
          return;
        }
        setVariantPrices([]);
      }
    };

    void loadPrices();

    return () => {
      isCancelled = true;
    };
  }, [parentId, sessionCurrency, variants, variantsLoaded]);

  const attributeGroups = useMemo(() => collectVariantAttributeGroups(product, variants), [product, variants]);
  const attributeOrder = useMemo(() => attributeGroups.map((group) => group.key), [attributeGroups]);
  const selectedAttributeValues = useMemo(() => getSelectedVariantAttributeValues(product), [product]);
  const carouselVariants = useMemo(() => {
    if (variants.some((variant) => variant.id === product.id)) {
      return variants;
    }
    if (product.parentVariantId && !product.isParentVariant) {
      return [product, ...variants];
    }
    return variants;
  }, [product, variants]);
  const compatibleValuesByAttribute = useMemo(
    () => getCompatibleValuesByAttribute(carouselVariants, selectedAttributeValues, attributeOrder),
    [carouselVariants, selectedAttributeValues, attributeOrder],
  );

  if (!shouldLoadVariants) {
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
        attributeLabels={product.templateAttributeLabels}
        attributeTypes={product.templateAttributeTypes}
      />
      <ProductVariantCarousel
        variants={carouselVariants}
        prices={variantPrices ?? []}
        currentProductId={product.id}
        attributeOrder={attributeOrder}
        attributeTypes={product.templateAttributeTypes}
      />
    </div>
  );
}
