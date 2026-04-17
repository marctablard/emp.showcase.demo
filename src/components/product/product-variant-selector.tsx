'use client';

import React from 'react';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import ProductVariantSelectorMulti from './product-variant-selector-multi';
import ProductVariantSelectorSimple from './product-variant-selector-simple';

export interface ProductVariantSelectorProps {
  product: Product;
  price?: ProductPrice | null;
  className?: string;
}

export default function ProductVariantSelector({ product, className }: ProductVariantSelectorProps) {
  // Determine if we should use tiles or dropdowns based on variant attributes
  const soloVariant = product.variantAttributes?.length === 1 ? product.variantAttributes[0] : null;

  if (soloVariant) {
    return <ProductVariantSelectorSimple product={product} soloVariant={soloVariant} className={className} />;
  }

  return <ProductVariantSelectorMulti product={product} className={className} />;
}
