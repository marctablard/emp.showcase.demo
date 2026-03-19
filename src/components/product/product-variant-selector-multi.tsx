'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useL10n } from '@/hooks/useL10n';
import { type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import { useRouter } from '@/i18n/navigation';
import { fetchProductVariants } from '@/lib/client/products';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { useProductStore } from '@/providers/StoreProvider';
import { getColorValue } from '@/utils/colors';

export interface ProductVariantSelectorMultiProps {
  product: Product;
  className?: string;
}

function buildAvailableAttributeValues(variants: Product[]): Record<string, Set<string>> {
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
}

// Filter available values based on current selection to show only valid combinations
function buildFilteredAttributeValues(
  variants: Product[],
  selectedAttributes: Record<string, string>,
  availableValues: Record<string, Set<string>>,
): Record<string, Set<string>> {
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
}

export default function ProductVariantSelectorMulti({ product, className }: ProductVariantSelectorMultiProps) {
  const [variants, setVariants] = useState<Product[]>([]);
  const [selectionByProduct, setSelectionByProduct] = useState<Record<string, Record<string, string>>>({});
  const [_isPending, startTransition] = useTransition();

  const router = useRouter();
  const t = useTranslations('product');
  const { l10n } = useL10n();
  const { getVariants, setVariants: storeSetVariants } = useProductStore();

  // Preselect UI controls with current product's selected attributes
  const defaultSelectedAttributes = useMemo<Record<string, string>>(() => {
    if (!product.variantAttributes) {
      return {};
    }

    return product.variantAttributes.reduce<Record<string, string>>((acc, variantAttribute) => {
      const selectedValue = variantAttribute.values?.find((value) => value.selected);
      if (selectedValue) {
        acc[variantAttribute.key] = selectedValue.key;
      }
      return acc;
    }, {});
  }, [product.variantAttributes]);

  const selectedAttributes = useMemo(
    () => selectionByProduct[product.id] ?? defaultSelectedAttributes,
    [selectionByProduct, product.id, defaultSelectedAttributes],
  );

  const availableAttributeValues = useMemo(() => buildAvailableAttributeValues(variants), [variants]);

  const filteredAttributeValues = useMemo(
    () => buildFilteredAttributeValues(variants, selectedAttributes, availableAttributeValues),
    [variants, selectedAttributes, availableAttributeValues],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadVariants = async () => {
      if (isCancelled) return;

      const parentId = product.parentVariantId || product.id;

      // Check store cache first
      const cached = getVariants(parentId);
      if (cached) {
        if (!isCancelled) setVariants(cached);
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
      }
    };

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [product.id, product.parentVariantId, getVariants, storeSetVariants]);

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
    if (Object.keys(selectedAttributes).length === 0 || variants.length === 0) {
      return;
    }

    const matchingVariant = findMatchingVariant(variants, selectedAttributes);
    if (matchingVariant && matchingVariant.id !== product.id) {
      startTransition(() => {
        router.push(`/product/${matchingVariant.id}`);
      });
    }
  }, [selectedAttributes, variants, router, findMatchingVariant, product.id]);

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
    setSelectionByProduct((prev) => ({
      ...prev,
      [product.id]: {
        ...selectedAttributes,
        [attribute]: value,
      },
    }));
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
              <label className="text-base font-medium">
                {l10n(
                  t(dk<ProductVariantAttributeKey>(`filters.mixins.productVariantAttributes.${variantAttribute.key}`), {
                    defaultValue: variantAttribute.key,
                  }),
                )}
              </label>
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
                          'tile w-8 h-8 border-2 transition-all duration-200 relative hover:border-border-action-hover',
                          isSelected ? 'border-border-action scale-100' : 'border-border-primary',
                          `color-tile-${attributeValue.key}`,
                        )}
                        title={l10n(attributeValue.name || attributeValue.key)}
                      >
                        {isSelected && (
                          <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-icon-action bg-surface-page rounded-full" />
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
            {index < (product.variantAttributes?.length || 0) - 1 && <hr className="mt-6 border-border-primary" />}
          </div>
        ))}
      </div>
    </div>
  );
}
