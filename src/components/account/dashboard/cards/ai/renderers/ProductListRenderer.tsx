'use client';

import React from 'react';
import type { ProductData, ProductListData } from '../types';
import { ProductCard } from './ProductCard';

interface ProductListRendererProps {
  data: ProductListData;
  onAddToCart: (productId: string, quantity: number) => void;
}

export const ProductListRenderer: React.FC<ProductListRendererProps> = ({ data, onAddToCart }) => {
  return (
    <div className="space-y-4">
      {data.context && <div className="text-text-body mb-4 text-base">{data.context}</div>}
      {data.products &&
        data.products.map((product: ProductData, index: number) => (
          <ProductCard key={product.productId || `product-${index}`} product={product} onAddToCart={onAddToCart} />
        ))}
    </div>
  );
};
