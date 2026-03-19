import { useEffect, useState } from 'react';
import { fetchProductVariants } from '@/lib/client/products';
import { getLogger } from '@/lib/logger/use-logger-client';
import { LocalizedString } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';
import { useProductStore } from '@/providers/StoreProvider';

interface VariantAttributeValue {
  key: string;
  name?: string | LocalizedString;
  unit?: string;
  selected?: boolean;
}

interface AvailableVariantValues {
  values: VariantAttributeValue[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and filter available variant attribute values
 * Returns only the values that are actually available in the product variants
 */
export function useAvailableVariantValues(product: Product, attributeKey?: string): AvailableVariantValues {
  const [values, setValues] = useState<VariantAttributeValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getVariants, setVariants } = useProductStore();

  useEffect(() => {
    const fetchAvailableValues = async () => {
      if (!product.variantAttributes || product.variantAttributes.length === 0) {
        setValues([]);
        return;
      }

      const targetAttribute = attributeKey
        ? product.variantAttributes.find((attr) => attr.key === attributeKey)
        : product.variantAttributes[0];

      if (!targetAttribute) {
        setValues([]);
        return;
      }

      const parentId = product.parentVariantId || product.id;
      if (!parentId) {
        setValues(targetAttribute.values || []);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Check store cache before making a network call
        let variants = getVariants(parentId);
        if (!variants) {
          variants = await fetchProductVariants(parentId);
          setVariants(parentId, variants);
        }

        const availableValues = new Set<string>();
        const valueDetails = new Map<string, VariantAttributeValue>();

        variants.forEach((variant) => {
          const variantAttribute = variant.variantAttributes?.find((attr) => attr.key === targetAttribute.key);

          if (variantAttribute?.values) {
            variantAttribute.values.forEach((value) => {
              if (value.selected) {
                availableValues.add(value.key);
                if (!valueDetails.has(value.key) || value.name) {
                  valueDetails.set(value.key, value);
                }
              }
            });
          }
        });

        const orderedValues: VariantAttributeValue[] = [];

        targetAttribute.values?.forEach((value) => {
          if (availableValues.has(value.key)) {
            const detailedValue = valueDetails.get(value.key) || value;
            orderedValues.push(detailedValue);
            availableValues.delete(value.key);
          }
        });

        availableValues.forEach((key) => {
          const value = valueDetails.get(key);
          if (value) {
            orderedValues.push(value);
          }
        });

        setValues(orderedValues);
      } catch (err) {
        getLogger().error({ err }, 'Error fetching available variant values');
        setError(err instanceof Error ? err.message : 'Failed to fetch variant values');
        setValues(targetAttribute.values || []);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableValues();
  }, [product, attributeKey, getVariants, setVariants]);

  return { values, loading, error };
}
