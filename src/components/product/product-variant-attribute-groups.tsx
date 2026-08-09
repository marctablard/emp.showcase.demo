'use client';

import { type JSX, useState } from 'react';
import { useTranslations } from 'next-intl';
import { H6 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useL10n } from '@/hooks/useL10n';
import { type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import type { ProductVariantAttributeGroup } from '@/lib/common/product-variant-attributes';
import { cn } from '@/lib/utils';

/** Max chips shown per attribute before Show more (Figma Speed row density). */
const VISIBLE_CHIP_LIMIT = 6;

export interface ProductVariantAttributeGroupsProps {
  groups: ProductVariantAttributeGroup[];
  /** Current product's selected value per attribute key. */
  selectedValues?: Record<string, string>;
  /**
   * Values compatible with the current selection per attribute key.
   * Reserved for COP-4811 interactive filtering — chips are display-only for now.
   */
  compatibleValuesByAttribute?: Record<string, ReadonlySet<string>>;
  className?: string;
}

type ChipVisualState = 'selected' | 'inactive';

function resolveChipState(
  attributeKey: string,
  value: string,
  selectedValues: Record<string, string> | undefined,
): ChipVisualState {
  return selectedValues?.[attributeKey] === value ? 'selected' : 'inactive';
}

/**
 * Figma Variant Selection (`12799:113082`) — chips of possible values grouped by
 * `productVariantAttributes`. Display-only for now (COP-4811 filters later):
 * selected chip keeps the strong border; all others are grayed with not-allowed cursor
 * and a tooltip pointing shoppers to the sellable variant list.
 */
export function ProductVariantAttributeGroups({
  groups,
  selectedValues,
  className,
}: Readonly<ProductVariantAttributeGroupsProps>): JSX.Element | null {
  const t = useTranslations('product');
  const { l10n } = useL10n();
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const selectViaListTooltip = t('variantAttributeSelectViaListTooltip');

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)} data-testid="product-variant-attribute-groups">
      {groups.map((group, groupIndex) => {
        const expanded = expandedKeys[group.key] === true;
        const hasOverflow = group.values.length > VISIBLE_CHIP_LIMIT;
        const visibleValues = expanded || !hasOverflow ? group.values : group.values.slice(0, VISIBLE_CHIP_LIMIT);
        const label = group.name
          ? l10n(group.name)
          : t(dk<ProductVariantAttributeKey>(`filters.mixins.productVariantAttributes.${group.key}`), {
              defaultValue: group.key,
            });

        return (
          <div key={group.key} className="flex flex-col gap-3">
            {groupIndex > 0 ? <div className="h-px w-full bg-border-primary" aria-hidden="true" /> : null}
            <H6>{label}</H6>
            <div className="flex flex-wrap items-center gap-3">
              {visibleValues.map((value) => {
                // Value keys are normalized to strings upstream; coerce for display safety.
                const displayValue = typeof value === 'string' ? value : String(value);
                const state = resolveChipState(group.key, displayValue, selectedValues);

                return (
                  <Tooltip key={displayValue} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'cursor-not-allowed rounded-sm px-2 py-2 text-base',
                          state === 'selected' && 'border-2 border-border-black text-text-body',
                          state === 'inactive' && 'border border-border-primary bg-surface-disabled text-text-disabled',
                        )}
                        data-testid="product-variant-attribute-chip"
                        data-chip-state={state}
                        aria-current={state === 'selected' ? 'true' : undefined}
                        aria-disabled="true"
                      >
                        {displayValue}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{selectViaListTooltip}</TooltipContent>
                  </Tooltip>
                );
              })}
              {hasOverflow ? (
                <UiLink
                  type="Button"
                  variant="textBold"
                  size="m"
                  onClick={() => {
                    setExpandedKeys((current) => ({ ...current, [group.key]: !expanded }));
                  }}
                >
                  {expanded ? t('showLess') : t('showMore')}
                </UiLink>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
