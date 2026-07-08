'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProductVariants } from '@/lib/client/products';
import { getLogger } from '@/lib/logger/use-logger-client';
import {
  buildAvailableAttributeValues,
  buildFilteredAttributeValues,
  filterVariantsBySelection,
  findMatchingVariant,
  getDefaultSelectedAttributes,
} from '@/lib/product/variant-configurator';
import { enrichProductsWithInferredVariantAttributes } from '@/lib/product/variant-name-parser';
import type { Product } from '@/platform/services/model/product';
import { useProductStore } from '@/providers/StoreProvider';

export function useVariantConfigurator(product: Product) {
  const [variants, setVariants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionByProduct, setSelectionByProduct] = useState<Record<string, Record<string, string>>>({});
  const { getVariants, setVariants: storeSetVariants } = useProductStore();

  const parentId = product.parentVariantId || product.id;

  const defaultSelectedAttributes = useMemo(() => getDefaultSelectedAttributes(product), [product]);

  const selectedAttributes = useMemo(
    () => selectionByProduct[product.id] ?? defaultSelectedAttributes,
    [selectionByProduct, product.id, defaultSelectedAttributes],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadVariants = async () => {
      setLoading(true);

      const cached = getVariants(parentId);
      if (cached) {
        if (!isCancelled) {
          setVariants(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const fetchedVariants = await fetchProductVariants(parentId);
        if (!isCancelled) {
          setVariants(fetchedVariants);
          storeSetVariants(parentId, fetchedVariants);
        }
      } catch (error) {
        getLogger().error({ err: error }, 'Failed to fetch variants');
        if (!isCancelled) {
          setVariants([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [parentId, getVariants, storeSetVariants]);

  const enrichedVariants = useMemo(
    () => enrichProductsWithInferredVariantAttributes(variants, product.id),
    [variants, product.id],
  );

  const availableAttributeValues = useMemo(() => buildAvailableAttributeValues(enrichedVariants), [enrichedVariants]);

  const filteredAttributeValues = useMemo(
    () => buildFilteredAttributeValues(enrichedVariants, selectedAttributes, availableAttributeValues),
    [enrichedVariants, selectedAttributes, availableAttributeValues],
  );

  const filteredVariants = useMemo(
    () => filterVariantsBySelection(enrichedVariants, selectedAttributes),
    [enrichedVariants, selectedAttributes],
  );

  const matchingVariant = useMemo(
    () => findMatchingVariant(enrichedVariants, selectedAttributes),
    [enrichedVariants, selectedAttributes],
  );

  const attributeDefinitions = useMemo(() => {
    if (product.variantAttributes?.length) {
      return product.variantAttributes;
    }

    return enrichedVariants.find((variant) => variant.variantAttributes?.length)?.variantAttributes ?? [];
  }, [product.variantAttributes, enrichedVariants]);

  const setAttributeValue = useCallback(
    (attributeKey: string, valueKey: string) => {
      setSelectionByProduct((prev) => {
        const current = prev[product.id] ?? defaultSelectedAttributes;
        const next = { ...current };

        if (current[attributeKey] === valueKey) {
          delete next[attributeKey];
        } else {
          next[attributeKey] = valueKey;
        }

        return {
          ...prev,
          [product.id]: next,
        };
      });
    },
    [product.id, defaultSelectedAttributes],
  );

  const clearAttribute = useCallback(
    (attributeKey: string) => {
      setSelectionByProduct((prev) => {
        const current = { ...(prev[product.id] ?? defaultSelectedAttributes) };
        delete current[attributeKey];
        return {
          ...prev,
          [product.id]: current,
        };
      });
    },
    [product.id, defaultSelectedAttributes],
  );

  const resetSelection = useCallback(() => {
    setSelectionByProduct((prev) => ({
      ...prev,
      [product.id]: {},
    }));
  }, [product.id]);

  const getAvailableValuesForAttribute = useCallback(
    (attributeKey: string) => {
      const originalAttribute = attributeDefinitions.find((attr) => attr.key === attributeKey);
      const filteredKeys = filteredAttributeValues[attributeKey] ?? new Set<string>();
      return originalAttribute?.values?.filter((value) => filteredKeys.has(value.key)) ?? [];
    },
    [attributeDefinitions, filteredAttributeValues],
  );

  return {
    variants,
    loading,
    attributeDefinitions,
    selectedAttributes,
    filteredVariants,
    matchingVariant,
    setAttributeValue,
    clearAttribute,
    resetSelection,
    getAvailableValuesForAttribute,
  };
}
