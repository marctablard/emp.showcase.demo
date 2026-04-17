'use client';

import React from 'react';
import type { UnifiedProductItem } from './ProductItem';
import { ProductItem } from './ProductItem';

interface ItemsListRendererProps {
  items: any[];
  currency: string;
  extractPrice: (priceObj: any) => { net: number; gross: number; tax: number };
  showImages?: boolean;
  showDescription?: boolean;
  linkToProduct?: boolean;
}

export const ItemsListRenderer: React.FC<ItemsListRendererProps> = ({
  items,
  currency,
  extractPrice,
  showImages = false,
  showDescription = false,
  linkToProduct = false,
}) => {
  return (
    <div className="bg-surface-primary rounded-lg border border-border-primary overflow-hidden">
      {items.map((item: any, itemIndex: number) => {
        const unifiedItem: UnifiedProductItem = {
          productId: item.productId,
          name: item.name,
          image: showImages ? item.image : undefined,
          description: showDescription ? item.description : undefined,
          quantity: item.quantity,
          price: item.price,
          currency: item.currency || currency,
          unitPrice: item.unitPrice
            ? (() => {
                const unitPriceData = extractPrice(item.unitPrice);
                return {
                  value: unitPriceData.gross || item.unitPrice.value || item.unitPrice,
                  currency: item.unitPrice.currency || item.currency || currency,
                  net: unitPriceData.net,
                  gross: unitPriceData.gross,
                  tax: unitPriceData.tax,
                };
              })()
            : item.unitNetValue || item.price
              ? (() => {
                  const unitPriceData = extractPrice({
                    net: item.unitNetValue,
                    gross: item.unitGrossValue,
                    value: item.price,
                  });
                  return {
                    value: unitPriceData.gross || item.price || 0,
                    currency: item.currency || currency,
                    net: unitPriceData.net,
                    gross: unitPriceData.gross,
                    tax: unitPriceData.tax,
                  };
                })()
              : undefined,
          totalPrice: item.totalPrice
            ? (() => {
                const totalPriceData = extractPrice(item.totalPrice);
                return {
                  value: totalPriceData.gross || item.totalPrice.value || item.totalPrice,
                  currency: item.totalPrice.currency || item.currency || currency,
                  net: totalPriceData.net,
                  gross: totalPriceData.gross,
                  tax: totalPriceData.tax,
                };
              })()
            : item.price && item.quantity
              ? (() => {
                  const qty = item.quantity || 1;
                  const price = item.price || 0;
                  return {
                    value: price * qty,
                    currency: item.currency || currency,
                    net: price * qty,
                    gross: price * qty,
                    tax: 0,
                  };
                })()
              : undefined,
        };
        return (
          <div key={itemIndex}>
            <div className="p-4">
              <ProductItem
                item={unifiedItem}
                currency={currency}
                showQuantity={true}
                showUnitPrice={true}
                showTotalPrice={true}
                showNetGross={true}
                linkToProduct={linkToProduct}
              />
            </div>
            {itemIndex < items.length - 1 && <div className="border-t border-border-primary"></div>}
          </div>
        );
      })}
    </div>
  );
};
