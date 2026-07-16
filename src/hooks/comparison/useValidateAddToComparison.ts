'use client';

import { useTranslations } from 'next-intl';
import type { Product } from '@/platform/services/model/product';

export interface AddToComparisonValidation {
  /** Whether the add-to-comparison action is blocked by product-level rules (parent variant). */
  disabled: boolean;
  /** Tooltip text explaining why the button is disabled, or undefined when enabled. */
  tooltip: string | undefined;
}

/**
 * Validates whether a product can be added to comparison.
 * Returns `disabled` flag and an explanatory `tooltip` when blocked.
 *
 * Rules:
 * 1. Parent variants cannot be compared.
 */
export function useValidateAddToComparison(product: Product | null | undefined): AddToComparisonValidation {
  const t = useTranslations('product');

  if (!product) {
    return { disabled: true, tooltip: undefined };
  }

  if (product.isParentVariant) {
    return { disabled: true, tooltip: t('compareTooltipMasterProduct') };
  }

  return { disabled: false, tooltip: undefined };
}
