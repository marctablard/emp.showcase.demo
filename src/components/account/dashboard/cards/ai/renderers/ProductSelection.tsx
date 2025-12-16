'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StructuredDataHandlers } from '../types';
import { ProductSelectionItem } from './ProductSelectionItem';

interface ProductSelectionProps {
  data: any;
  setQuestionValue: StructuredDataHandlers['setQuestionValue'];
  handleQuestionSubmit: StructuredDataHandlers['handleQuestionSubmit'];
}

export const ProductSelection: React.FC<ProductSelectionProps> = ({ data, setQuestionValue, handleQuestionSubmit }) => {
  const t = useTranslations('account.AiHelper');
  const [selections, setSelections] = useState<Record<string, { selected: boolean; quantity: number }>>({});

  const handleSelectionChange = (itemId: string, selected: boolean, quantity: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { selected, quantity },
    }));
  };

  const handleAddSelectedToCart = () => {
    const selectedItems = Object.entries(selections)
      .filter(([_, selection]) => selection.selected)
      .map(([itemId, selection]) => t('addToCartMessage', { productId: itemId, quantity: selection.quantity }))
      .join('; ');

    if (selectedItems) {
      setQuestionValue(selectedItems);
      requestAnimationFrame(() => {
        handleQuestionSubmit({ question: selectedItems });
      });
    }
  };

  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  return (
    <div>
      <div className="text-sm font-semibold text-text-body mb-3">{t('productSelection')}</div>
      <div className="text-sm space-y-4">
        {data.message && <div className="text-text-body mb-3">{data.message}</div>}
        {data.variantGroups &&
          data.variantGroups.map((group: any, groupIndex: number) => (
            <div key={groupIndex} className="p-3 bg-surface-primary rounded border">
              <div className="font-medium text-text-body text-base mb-2">{group.message}</div>
              {group.description && <div className="text-sm text-text-body mb-3">{group.description}</div>}
              <div className="space-y-3">
                {group.items &&
                  group.items.map((item: any, itemIndex: number) => (
                    <ProductSelectionItem key={itemIndex} item={item} onSelectionChange={handleSelectionChange} />
                  ))}
              </div>
            </div>
          ))}
        {data.instructions && (
          <div className="text-sm text-text-body mt-4 p-3 bg-surface-action-hover-2 rounded border">
            {data.instructions}
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={handleAddSelectedToCart}
            disabled={selectedCount === 0}
            className="w-full px-4 py-2 bg-surface-action text-text-on-action text-sm rounded hover:bg-surface-action-hover transition-colors disabled:bg-surface-disabled-selected disabled:cursor-not-allowed"
          >
            {t('addSelectedToCart', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
};
