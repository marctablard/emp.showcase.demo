'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { fetchProductVariants } from '@/lib/client/products';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { getColorValue } from '@/utils/colors';

export interface ProductVariantSelectorMultiProps {
  product: Product;
  className?: string;
}

export default function ProductVariantSelectorMulti({ product, className }: ProductVariantSelectorMultiProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [variants, setVariants] = useState<Product[]>([]);
  const [availableAttributeValues, setAvailableAttributeValues] = useState<Record<string, Set<string>>>({});
  const [filteredAttributeValues, setFilteredAttributeValues] = useState<Record<string, Set<string>>>({});
  const [_isPending, startTransition] = useTransition();

  const router = useRouter();
  const t = useTranslations('product');
  const { l10n } = useL10n();

  // Collect all available values per variant attribute from all variants
  const collectAvailableAttributeValues = useCallback((variants: Product[]) => {
    const availableValues: Record<string, Set<string>> = {};

    variants.forEach((variant) => {
      variant.variantAttributes?.forEach((variantAttribute) => {
        if (!availableValues[variantAttribute.key]) {
          availableValues[variantAttribute.key] = new Set();
        }

        variantAttribute.values?.forEach((value) => {
          if (value.selected) {
            availableValues[variantAttribute.key].add(value.key);
          }
        });
      });
    });

    return availableValues;
  }, []);

  // Filter available values based on current selection to show only valid combinations
  const getFilteredAttributeValues = useCallback(
    (variants: Product[], selectedAttributes: Record<string, string>, availableValues: Record<string, Set<string>>) => {
      const filteredValues: Record<string, Set<string>> = {};

      // Initialize with all available values
      Object.keys(availableValues).forEach((attributeKey) => {
        filteredValues[attributeKey] = new Set(availableValues[attributeKey]);
      });

      // If no attributes are selected, return all available values
      if (Object.keys(selectedAttributes).length === 0) {
        return filteredValues;
      }

      // Filter variants that match the current selection (excluding the attribute we're filtering for)
      Object.keys(availableValues).forEach((targetAttributeKey) => {
        const validValues = new Set<string>();

        variants.forEach((variant) => {
          // Check if this variant matches all selected attributes except the target one
          const variantAttributes: Record<string, string> = {};
          variant.variantAttributes?.forEach((attr) => {
            const selectedValue = attr.values?.find((v) => v.selected);
            if (selectedValue) {
              variantAttributes[attr.key] = selectedValue.key;
            }
          });

          // Check if variant matches all selected attributes except the target attribute
          const matchesSelection = Object.entries(selectedAttributes).every(([key, value]) => {
            if (key === targetAttributeKey) return true; // Skip the target attribute
            return variantAttributes[key] === value;
          });

          if (matchesSelection && variantAttributes[targetAttributeKey]) {
            validValues.add(variantAttributes[targetAttributeKey]);
          }
        });

        filteredValues[targetAttributeKey] = validValues;
      });

      return filteredValues;
    },
    [],
  );

  const getVariants = useCallback(async () => {
    try {
      const variants = await fetchProductVariants(product.parentVariantId || product.id);
      setVariants(variants);

      // Collect available attribute values from all variants
      const availableValues = collectAvailableAttributeValues(variants);
      setAvailableAttributeValues(availableValues);

      // Initially, all values are available
      setFilteredAttributeValues(availableValues);
    } catch (error) {
      console.error('Failed to fetch variants:', error);
    }
  }, [product, collectAvailableAttributeValues]);

  // Find a variant that matches all selected attributes
  const findMatchingVariant = useCallback(
    (variants: Product[], attributes: Record<string, string>): Product | undefined => {
      // Find variant where all of its selected attributes match the UI selection
      return variants.find((variant) => {
        // Get all selected attributes from this variant
        const variantSelectedAttributes: Record<string, string> = {};

        variant.variantAttributes?.forEach((variantAttribute) => {
          const selectedValue = variantAttribute.values?.find((value) => value.selected === true);
          if (selectedValue) {
            variantSelectedAttributes[variantAttribute.key] = selectedValue.key;
          }
        });

        // Check if all variant's selected attributes match the UI selection
        return Object.entries(variantSelectedAttributes).every(([attributeKey, variantValue]) => {
          return attributes[attributeKey] === variantValue;
        });
      });
    },
    [],
  );

  useEffect(() => {
    getVariants();
  }, [getVariants]);

  // Update filtered values when selection changes
  useEffect(() => {
    if (variants.length > 0 && Object.keys(availableAttributeValues).length > 0) {
      const filtered = getFilteredAttributeValues(variants, selectedAttributes, availableAttributeValues);
      setFilteredAttributeValues(filtered);
    }
  }, [selectedAttributes, variants, availableAttributeValues, getFilteredAttributeValues]);

  // Preselect UI controls with current product's selected attributes
  useEffect(() => {
    if (!product.variantAttributes) return;

    const currentSelectedAttributes: Record<string, string> = {};

    product.variantAttributes.forEach((variantAttribute) => {
      const selectedValue = variantAttribute.values?.find((value) => value.selected === true);
      if (selectedValue) {
        currentSelectedAttributes[variantAttribute.key] = selectedValue.key;
      }
    });

    // Only update if we found selected attributes and they're different from current state
    if (Object.keys(currentSelectedAttributes).length > 0) {
      setSelectedAttributes(currentSelectedAttributes);
    }
  }, [product]);

  // React to changes in selectedAttributes and variants to find matching variant
  useEffect(() => {
    // Only proceed if we have selected attributes and variants are loaded
    if (Object.keys(selectedAttributes).length === 0 || variants.length === 0) {
      return;
    }

    const matchingVariant = findMatchingVariant(variants, selectedAttributes);
    if (matchingVariant) {
      startTransition(() => {
        router.push(`/product/${matchingVariant.id}`);
      });
    }
  }, [selectedAttributes, variants, router, findMatchingVariant]);

  // Get available attribute values for display (with names from original product)
  const getAvailableAttributeValues = useCallback(
    (attributeKey: string) => {
      const originalAttribute = product.variantAttributes?.find((attr) => attr.key === attributeKey);
      const filteredKeys = filteredAttributeValues[attributeKey] || new Set();

      return originalAttribute?.values?.filter((value) => filteredKeys.has(value.key)) || [];
    },
    [product.variantAttributes, filteredAttributeValues],
  );

  // Handle attribute selection via dropdowns
  const handleAttributeChange = (attribute: string, value: string) => {
    const newSelectedAttributes = {
      ...selectedAttributes,
      [attribute]: value,
    };
    setSelectedAttributes(newSelectedAttributes);
  };

  if (!product.variantAttributes) {
    return null;
  }

  return (
    <div className={cn('my-6', className)}>
      <div className="flex flex-col gap-6">
        {product.variantAttributes.map((variantAttribute, index) => (
          <div key={variantAttribute.key}>
            <div className="flex flex-col gap-1">
              <label className="text-md font-medium">{l10n(variantAttribute.name || variantAttribute.key)}</label>
              {variantAttribute.key === 'color' || variantAttribute.key === 'farbe' ? (
                <div className="flex flex-wrap gap-2">
                  <style type="text/css">
                    {getAvailableAttributeValues(variantAttribute.key).map((attributeValue) => {
                      return `.color-tile-${attributeValue.key} { background-color: ${getColorValue(attributeValue.key)}; }\n`;
                    })}
                  </style>
                  {getAvailableAttributeValues(variantAttribute.key).map((attributeValue) => {
                    const isSelected = selectedAttributes[variantAttribute.key] === attributeValue.key;
                    return (
                      <button
                        type="button"
                        key={attributeValue.key}
                        onClick={() => handleAttributeChange(variantAttribute.key, attributeValue.key)}
                        className={cn(
                          'tile w-8 h-8 border-2 border-neutral-500 transition-all duration-200 relative',
                          isSelected ? 'border-primary scale-100' : 'border-neutral-500 hover:border-neutral-600',
                          `color-tile-${attributeValue.key}`,
                        )}
                        title={l10n(attributeValue.name || attributeValue.key)}
                      >
                        {isSelected && (
                          <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-primary bg-white rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Select
                  value={selectedAttributes[variantAttribute.key] || ''}
                  onValueChange={(value) => handleAttributeChange(variantAttribute.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t(`variantSelectPlaceholder`, { defaultValue: 'Select variant' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableAttributeValues(variantAttribute.key).map((attributeValue) => (
                      <SelectItem key={attributeValue.key} value={attributeValue.key}>
                        {l10n(attributeValue.name || attributeValue.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {index < (product.variantAttributes?.length || 0) - 1 && <hr className="mt-6 border-gray-200" />}
          </div>
        ))}
      </div>
    </div>
  );
}
