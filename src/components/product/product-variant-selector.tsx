'use client';

import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useClientFetchScope } from '@/hooks/common/useClientFetchScope';
import { useSession } from '@/hooks/session/useSession';
import { useRouter } from '@/i18n/navigation';
import { fetchProductPrices } from '@/lib/client/prices';
import { fetchProductVariants } from '@/lib/client/products';
import { filterDynamicMembersByQualifiers, filterSellableDynamicMembers } from '@/lib/common/product-dynamic-variants';
import {
  collectVariantAttributeGroups,
  getCompatibleAttributeValuesForFilters,
  getSelectedVariantAttributeValues,
  isVariantFamilyProduct,
  variantFilterValues,
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

function navigateToProduct(router: { push: (href: string) => void }, productId: string): void {
  startTransition(() => {
    router.push(`/product/${productId}`);
  });
}

function isDynamicVariantFamily(product: Product, family: Product[]): boolean {
  return product.productType === 'DYNAMIC_VARIANT' || family.some((member) => member.productType === 'DYNAMIC_VARIANT');
}

function includeOpenedFamilyMember(product: Product, variants: Product[]): Product[] {
  if (variants.some((variant) => variant.id === product.id)) {
    return variants;
  }
  if (product.productType === 'DYNAMIC_VARIANT') {
    return [product, ...variants];
  }
  if (product.parentVariantId && !product.isParentVariant) {
    return [product, ...variants];
  }
  return variants;
}

/** Blue border marks the opened node's own attributes. Parents and dynamic roots stay unmarked. */
function isOpenedVariantProduct(product: Product): boolean {
  if (product.isParentVariant || product.productType === 'PARENT_VARIANT') {
    return false;
  }
  if (product.productType === 'DYNAMIC_VARIANT') {
    const rootId = product.parentVariantPath?.at(-1);
    if (rootId && rootId !== product.id) {
      return true;
    }
    return Boolean(product.parentVariantId);
  }
  return Boolean(product.parentVariantId);
}

function toggleFilterValue(
  current: Record<string, string[]>,
  attributeKey: string,
  value: string,
): Record<string, string[]> {
  const existing = current[attributeKey] ?? [];
  const nextValues = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value];
  if (nextValues.length === 0) {
    const next = { ...current };
    delete next[attributeKey];
    return next;
  }
  return { ...current, [attributeKey]: nextValues };
}

/** Classic members stay selectable unless marked unsellable. Dynamic nodes must be sellable === true. */
function isSelectableSellableMember(member: Product): boolean {
  if (member.productType === 'DYNAMIC_VARIANT') {
    return member.sellable === true;
  }
  return member.sellable !== false;
}

function placeOpenedVariantFirst(variants: Product[], openedId: string): Product[] {
  const index = variants.findIndex((variant) => variant.id === openedId);
  if (index <= 0) {
    return variants;
  }
  return [variants[index], ...variants.slice(0, index), ...variants.slice(index + 1)];
}

function buildSellableListSource(product: Product, family: Product[]): Product[] {
  if (isDynamicVariantFamily(product, family)) {
    return filterSellableDynamicMembers(family, product.id);
  }
  return family;
}

/**
 * PDP variant area: interactive attribute chips + sellable-variants carousel.
 * Replaces the previous simple card grid / multi dropdowns (Figma `12799:113082` + `12799:113107`).
 */
export default function ProductVariantSelector({ product, className }: ProductVariantSelectorProps) {
  const router = useRouter();
  const [variants, setVariants] = useState<Product[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantPrices, setVariantPrices] = useState<ProductPrice[] | undefined>(undefined);
  const [filterSelection, setFilterSelection] = useState<Record<string, string[]>>({});
  const [isListLoading, setIsListLoading] = useState(false);
  const { session } = useSession();
  const clientDedupeScope = useClientFetchScope();

  const shouldLoadVariants = isVariantFamilyProduct(product);
  const [prevProductId, setPrevProductId] = useState(product.id);
  const [prevClientDedupeScope, setPrevClientDedupeScope] = useState(clientDedupeScope);
  if (prevProductId !== product.id || prevClientDedupeScope !== clientDedupeScope) {
    setPrevProductId(product.id);
    setPrevClientDedupeScope(clientDedupeScope);
    setVariants([]);
    setVariantsLoaded(false);
    setVariantPrices(undefined);
    setFilterSelection({});
    setIsListLoading(false);
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
        const fetchedVariants = await fetchProductVariants(product.id, clientDedupeScope);
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
  }, [product.id, shouldLoadVariants, clientDedupeScope]);

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
  }, [product.id, sessionCurrency, variants, variantsLoaded]);

  const attributeGroups = useMemo(() => collectVariantAttributeGroups(product, variants), [product, variants]);
  const attributeOrder = useMemo(() => attributeGroups.map((group) => group.key), [attributeGroups]);
  const familyVariants = useMemo(() => includeOpenedFamilyMember(product, variants), [product, variants]);
  const openedMember = useMemo(
    () => familyVariants.find((variant) => variant.id === product.id) ?? product,
    [familyVariants, product],
  );
  const selectedAttributeValues = useMemo(
    () => (isOpenedVariantProduct(product) ? getSelectedVariantAttributeValues(openedMember) : {}),
    [openedMember, product],
  );
  const listSource = useMemo(() => buildSellableListSource(product, familyVariants), [familyVariants, product]);
  const listVariants = useMemo(
    () => placeOpenedVariantFirst(filterDynamicMembersByQualifiers(listSource, filterSelection), product.id),
    [filterSelection, listSource, product.id],
  );
  const disabledValues = useMemo(() => {
    const sellableMembers = familyVariants.filter(isSelectableSellableMember);
    const disabled: Record<string, string[]> = {};
    attributeGroups.forEach((group) => {
      const compatible = getCompatibleAttributeValuesForFilters(sellableMembers, filterSelection, group.key);
      const selected = variantFilterValues(filterSelection[group.key]);
      disabled[group.key] = group.values.filter((value) => !compatible.has(value) && !selected.includes(value));
    });
    return disabled;
  }, [attributeGroups, familyVariants, filterSelection]);

  const handleAttributeSelect = (attributeKey: string, value: string): void => {
    setFilterSelection((current) => toggleFilterValue(current, attributeKey, value));
  };

  const handleClearAllFilters = (): void => {
    setFilterSelection({});
  };

  const handleVariantSelect = (variantId: string): void => {
    if (variantId === product.id) {
      return;
    }
    setIsListLoading(true);
    navigateToProduct(router, variantId);
  };

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
        selectedValues={filterSelection}
        productValues={selectedAttributeValues}
        disabledValues={disabledValues}
        attributeLabels={product.templateAttributeLabels}
        attributeTypes={product.templateAttributeTypes}
        onSelect={handleAttributeSelect}
        onClearAll={handleClearAllFilters}
      />
      <ProductVariantCarousel
        variants={listVariants}
        prices={variantPrices ?? []}
        currentProductId={product.id}
        attributeOrder={attributeOrder}
        attributeTypes={product.templateAttributeTypes}
        attributeLabels={product.templateAttributeLabels}
        selectedFilters={filterSelection}
        isLoading={isListLoading}
        onVariantSelect={handleVariantSelect}
      />
    </div>
  );
}
