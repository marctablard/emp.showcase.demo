'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ProductSelectionData, ProductSelectionItemData, StructuredDataHandlers } from '../types';
import { formatPrice } from '../utils';
import {
  AiQuantityStepper,
  AiThumbnail,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
  aiWidgetPaddingX,
} from './ai-widget-kit';

interface ProductSelectionProps {
  data: ProductSelectionData;
  setQuestionValue: StructuredDataHandlers['setQuestionValue'];
  handleQuestionSubmit: StructuredDataHandlers['handleQuestionSubmit'];
}

type Selection = { selected: boolean; quantity: number };

function SelectionRow({
  item,
  selection,
  onChange,
}: Readonly<{ item: ProductSelectionItemData; selection: Selection; onChange: (next: Selection) => void }>) {
  const t = useTranslations('account.AiHelper');
  const testIdPrefix = `aiProductSelection-${item.itemId}`;
  const attributes = Object.entries(item.attributes ?? {});
  let price: string = t('priceOnRequest');
  if (typeof item.price === 'number') {
    price = formatPrice(item.price, item.currency);
  } else if (item.price) {
    price = `${item.price} ${item.currency ?? ''}`.trim();
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Checkbox
        className="h-5 w-5 [&_svg]:h-4 [&_svg]:w-4"
        checked={selection.selected}
        onCheckedChange={(checked) => onChange({ ...selection, selected: checked === true })}
        aria-label={item.name}
        data-testid={`${testIdPrefix}-checkbox`}
      />
      <AiThumbnail src={item.image} alt={item.name} size={44} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium text-text-headings">{item.name}</p>
        {item.description ? <p className="line-clamp-1 text-xs text-text-placeholders">{item.description}</p> : null}
        {attributes.length > 0 ? (
          <p className="text-xs text-text-placeholders">
            {attributes.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
          </p>
        ) : null}
        <p className={cn('tabular-nums', item.price ? 'font-semibold text-text-headings' : 'text-text-placeholders')}>
          {price}
        </p>
      </div>
      <AiQuantityStepper
        value={selection.quantity}
        onChange={(quantity) => onChange({ ...selection, quantity })}
        testIdPrefix={testIdPrefix}
      />
    </li>
  );
}

export const ProductSelection: React.FC<ProductSelectionProps> = ({ data, setQuestionValue, handleQuestionSubmit }) => {
  const t = useTranslations('account.AiHelper');
  const [selections, setSelections] = useState<Record<string, Selection>>({});

  const selectionOf = (itemId: string): Selection => selections[itemId] ?? { selected: false, quantity: 1 };
  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  const handleAddSelectedToCart = () => {
    const selectedItems = Object.entries(selections)
      .filter(([, selection]) => selection.selected)
      .map(([itemId, selection]) => t('addToCartMessage', { productId: itemId, quantity: selection.quantity }))
      .join('; ');

    if (selectedItems) {
      setQuestionValue(selectedItems);
      requestAnimationFrame(() => {
        handleQuestionSubmit({ question: selectedItems });
      });
    }
  };

  return (
    <AiWidgetFrame>
      <AiWidgetHeader eyebrow={t('productSelection')} title={data.message || t('productSelection')} />
      {data.variantGroups?.map((group, groupIndex) => (
        <AiWidgetSection key={`${group.message}-${groupIndex}`} label={group.message}>
          {group.description ? <p className="mb-1 text-xs text-text-placeholders">{group.description}</p> : null}
          <ul className="divide-y divide-border-primary">
            {group.items?.map((item) => (
              <SelectionRow
                key={item.itemId}
                item={item}
                selection={selectionOf(item.itemId)}
                onChange={(next) => setSelections((prev) => ({ ...prev, [item.itemId]: next }))}
              />
            ))}
          </ul>
        </AiWidgetSection>
      ))}
      {data.instructions ? (
        <p className={cn('border-b border-border-primary py-2.5 text-xs text-text-placeholders', aiWidgetPaddingX)}>
          {data.instructions}
        </p>
      ) : null}
      <div className={cn('flex justify-end py-2.5', aiWidgetPaddingX)}>
        <Button
          type="button"
          size="small"
          className="h-8 px-3 text-sm"
          onClick={handleAddSelectedToCart}
          disabled={selectedCount === 0}
          data-testid="aiProductSelection-addSelectedToCart"
        >
          {t('addSelectedToCart', { count: selectedCount })}
        </Button>
      </div>
    </AiWidgetFrame>
  );
};
