'use client';

import { Fragment, type JSX, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { H6 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { useL10n } from '@/hooks/useL10n';
import { formatTemplateAttributeValue, resolveVariantAttributeLabel } from '@/lib/common/product-template-attributes';
import {
  type ProductVariantAttributeGroup,
  type VariantAttributeFilters,
  variantFilterValues,
} from '@/lib/common/product-variant-attributes';
import { cn } from '@/lib/utils';
import type { LocalizedString } from '@/platform/services/model/common';
import type { ProductTemplateAttributeType } from '@/platform/services/model/product';

/** Max chips shown per attribute before Show more (Figma Speed row density). */
const VISIBLE_CHIP_LIMIT = 6;

export type VariantAttributeChipState = 'selected' | 'soft' | 'inactive';

export interface ProductVariantAttributeGroupsProps {
  groups: ProductVariantAttributeGroup[];
  /** Shopper chip-filter selection (black border). Several values on one axis are OR. */
  selectedValues?: VariantAttributeFilters;
  /** Opened variant values (thin blue border). */
  productValues?: Record<string, string>;
  /** Localized names from Product Templates `attributes[].name`. */
  attributeLabels?: Record<string, LocalizedString>;
  /** Types from Product Templates `attributes[].type` for locale-aware value formatting. */
  attributeTypes?: Record<string, ProductTemplateAttributeType>;
  onSelect?: (attributeKey: string, value: string) => void;
  onClearAll?: () => void;
  className?: string;
}

function resolveChipState(
  attributeKey: string,
  value: string,
  selectedValues: VariantAttributeFilters | undefined,
  productValues: Record<string, string> | undefined,
): VariantAttributeChipState {
  if (variantFilterValues(selectedValues?.[attributeKey]).includes(value)) {
    return 'selected';
  }
  if (productValues?.[attributeKey] === value) {
    return 'soft';
  }
  return 'inactive';
}

function chipStateClassName(state: VariantAttributeChipState): string {
  switch (state) {
    case 'selected':
      return 'cursor-pointer border-2 border-border-black text-text-body';
    case 'soft':
      return 'cursor-pointer border border-border-secondary text-text-body';
    default:
      return 'cursor-pointer border border-border-primary text-text-body';
  }
}

interface VariantAttributeChipProps {
  attributeKey: string;
  rawValue: string;
  displayValue: string;
  state: VariantAttributeChipState;
  onSelect?: (attributeKey: string, value: string) => void;
}

function VariantAttributeChip({
  attributeKey,
  rawValue,
  displayValue,
  state,
  onSelect,
}: Readonly<VariantAttributeChipProps>): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'rounded-sm px-2 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
        chipStateClassName(state),
      )}
      data-testid="product-variant-attribute-chip"
      data-chip-state={state}
      aria-pressed={state === 'selected'}
      aria-current={state === 'soft' ? 'true' : undefined}
      onClick={() => onSelect?.(attributeKey, rawValue)}
    >
      {displayValue}
    </button>
  );
}

/**
 * Figma Variant Selection (`12799:113082`) — interactive chips grouped by attribute.
 * Every value stays clickable. Black border = shopper filter; thin blue border = opened variant.
 */
export function ProductVariantAttributeGroups({
  groups,
  selectedValues,
  productValues,
  attributeLabels,
  attributeTypes,
  onSelect,
  onClearAll,
  className,
}: Readonly<ProductVariantAttributeGroupsProps>): JSX.Element | null {
  const t = useTranslations('product');
  const locale = useLocale();
  const { l10n } = useL10n();
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col items-start gap-4', className)} data-testid="product-variant-attribute-groups">
      {groups.map((group, groupIndex) => {
        const expanded = expandedKeys[group.key] === true;
        const hasOverflow = group.values.length > VISIBLE_CHIP_LIMIT;
        const visibleValues = expanded || !hasOverflow ? group.values : group.values.slice(0, VISIBLE_CHIP_LIMIT);
        const label = resolveVariantAttributeLabel(group.key, group.name, attributeLabels, l10n);

        return (
          <Fragment key={group.key}>
            {groupIndex > 0 ? <div className="h-px w-full bg-border-primary" aria-hidden="true" /> : null}
            <div className="flex w-full flex-col gap-3">
              {/* Figma 12799:113082 Desktop/heading/h6 — pin desktop tokens; H6 text-2xl is mobile 12/12 below 1024px (COP-4811). */}
              <H6 className="text-[length:var(--desktop-font-size-heading-h6)] leading-[var(--desktop-line-height-heading-h6)]">
                {label}
              </H6>
              <div className="flex flex-wrap items-center gap-3">
                {visibleValues.map((value) => {
                  const rawValue = typeof value === 'string' ? value : String(value);
                  const displayValue = formatTemplateAttributeValue(rawValue, attributeTypes?.[group.key], locale);
                  const state = resolveChipState(group.key, rawValue, selectedValues, productValues);

                  return (
                    <VariantAttributeChip
                      key={rawValue}
                      attributeKey={group.key}
                      rawValue={rawValue}
                      displayValue={displayValue}
                      state={state}
                      onSelect={onSelect}
                    />
                  );
                })}
                {hasOverflow ? (
                  <UiLink
                    type="Button"
                    variant="textBold"
                    size="m"
                    aria-expanded={expanded}
                    data-testid={
                      expanded ? `product-variant-showLess-${group.key}` : `product-variant-showMore-${group.key}`
                    }
                    data-attribute-key={group.key}
                    onClick={() => {
                      setExpandedKeys((current) => ({ ...current, [group.key]: !expanded }));
                    }}
                  >
                    {expanded ? t('showLess') : t('showMore')}
                  </UiLink>
                ) : null}
              </div>
            </div>
          </Fragment>
        );
      })}
      <div className="h-px w-full bg-border-primary" aria-hidden="true" />
      <UiLink
        type="Button"
        variant="textBold"
        size="m"
        className="inline-flex w-auto text-left"
        data-testid="product-variant-clearAllFilters"
        onClick={onClearAll}
      >
        {t('clearAllFilters')}
      </UiLink>
    </div>
  );
}
