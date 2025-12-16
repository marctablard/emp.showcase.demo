import { useEffect, useState } from 'react';
import { fetchProductVariants } from '@/lib/client/products';
import { LocalizedString } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';

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

  useEffect(() => {
    const fetchAvailableValues = async () => {
      // If no variant attributes or no specific attribute key, return empty
      if (!product.variantAttributes || product.variantAttributes.length === 0) {
        setValues([]);
        return;
      }

      // Use the first variant attribute if no specific key is provided
      const targetAttribute = attributeKey
        ? product.variantAttributes.find((attr) => attr.key === attributeKey)
        : product.variantAttributes[0];

      if (!targetAttribute) {
        setValues([]);
        return;
      }

      // If no parent variant ID, use current product's values
      const parentId = product.parentVariantId || product.id;
      if (!parentId) {
        setValues(targetAttribute.values || []);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all variants for this product family
        const variants = await fetchProductVariants(parentId);

        // Collect all available values for the target attribute across all variants
        const availableValues = new Set<string>();
        const valueDetails = new Map<string, VariantAttributeValue>();

        variants.forEach((variant) => {
          const variantAttribute = variant.variantAttributes?.find((attr) => attr.key === targetAttribute.key);

          if (variantAttribute?.values) {
            variantAttribute.values.forEach((value) => {
              if (value.selected) {
                availableValues.add(value.key);
                // Store the most complete value details we find
                if (!valueDetails.has(value.key) || value.name) {
                  valueDetails.set(value.key, value);
                }
              }
            });
          }
        });

        // Convert to array and maintain original order from the current product if possible
        const orderedValues: VariantAttributeValue[] = [];

        // First, add values in the order they appear in the current product
        targetAttribute.values?.forEach((value) => {
          if (availableValues.has(value.key)) {
            const detailedValue = valueDetails.get(value.key) || value;
            orderedValues.push(detailedValue);
            availableValues.delete(value.key);
          }
        });

        // Then add any remaining values that weren't in the current product
        availableValues.forEach((key) => {
          const value = valueDetails.get(key);
          if (value) {
            orderedValues.push(value);
          }
        });

        setValues(orderedValues);
      } catch (err) {
        console.error('Error fetching available variant values:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch variant values');
        // Fallback to current product's values
        setValues(targetAttribute.values || []);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableValues();
  }, [product, attributeKey]);

  return { values, loading, error };
}
