'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ProductSelectionItem as ProductSelectionItemType } from '../types';
import { formatPrice, handleImageError } from '../utils';

interface ProductSelectionItemProps {
  item: ProductSelectionItemType;
  onSelectionChange: (itemId: string, selected: boolean, quantity: number) => void;
}

export const ProductSelectionItem: React.FC<ProductSelectionItemProps> = ({ item, onSelectionChange }) => {
  const t = useTranslations('account.AiHelper');
  const [selected, setSelected] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleSelectionChange = (checked: boolean) => {
    setSelected(checked);
    onSelectionChange(item.itemId, checked, quantity);
  };

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
    if (selected) {
      onSelectionChange(item.itemId, selected, newQuantity);
    }
  };

  const incrementQuantity = () => {
    handleQuantityChange(quantity + 1);
  };

  const decrementQuantity = () => {
    handleQuantityChange(Math.max(1, quantity - 1));
  };

  return (
    <div className="flex items-start space-x-3 p-3 border border-border-primary rounded-lg">
      <div className="flex-shrink-0 pt-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => handleSelectionChange(e.target.checked)}
          className="w-4 h-4 text-text-action border-border-disabled rounded focus:ring-border-focus"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start space-x-3">
          {item.image && (
            <Image
              src={item.image}
              alt={item.name}
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded"
              onError={handleImageError}
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text-body text-base mb-1">{item.name}</div>
            {item.description && <div className="text-sm text-text-body mb-2">{item.description}</div>}
            <div className="flex items-center space-x-2 mb-2">
              {item.price ? (
                <span className="font-medium text-sm">
                  {typeof item.price === 'number'
                    ? formatPrice(item.price, item.currency)
                    : `${item.price} ${item.currency}`}
                </span>
              ) : (
                <span className="text-sm text-text-placeholders">{t('priceOnRequest')}</span>
              )}
            </div>
            {item.attributes && (
              <div className="text-xs text-text-placeholders">
                {Object.entries(item.attributes).map(([key, value]) => (
                  <span key={key} className="mr-2">
                    <strong>{key}:</strong> {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
        <div className="flex items-center border border-border-disabled rounded">
          <button
            onClick={decrementQuantity}
            className="px-2 py-1 text-sm hover:bg-surface-disabled"
            disabled={quantity <= 1}
          >
            -
          </button>
          <span className="px-3 py-1 text-sm border-x border-border-disabled">{quantity}</span>
          <button onClick={incrementQuantity} className="px-2 py-1 text-sm hover:bg-surface-disabled">
            +
          </button>
        </div>
      </div>
    </div>
  );
};
