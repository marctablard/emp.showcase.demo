'use client';

import React from 'react';
import { toDisplayString } from '@/lib/common/ai-tool-widgets';
import type { ProductData, ProductListData } from '../types';
import { ProductCard } from './ProductCard';
import { widgetOrSkeleton } from './WidgetSkeleton';

interface ProductListRendererProps {
  data: ProductListData;
  onAddToCart: (productId: string, quantity: number) => void;
}

export const ProductListRenderer: React.FC<ProductListRendererProps> = ({ data, onAddToCart }) => {
  const context = toDisplayString(data.context);

  return widgetOrSkeleton(
    data.products,
    <div className="space-y-4">
      {context && <div className="text-text-body mb-4 text-base">{context}</div>}
      {data.products?.map((product: ProductData, index: number) => (
        <ProductCard key={product.productId || `product-${index}`} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>,
  );
};
