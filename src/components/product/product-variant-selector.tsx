'use client';

import React from 'react';
import { isVariantConfiguratorProduct } from '@/lib/product/variant-configurator';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import ProductVariantConfigurator from './product-variant-configurator';
import ProductVariantSelectorMulti from './product-variant-selector-multi';
import ProductVariantSelectorSimple from './product-variant-selector-simple';

export interface ProductVariantSelectorProps {
  product: Product;
  price?: ProductPrice | null;
  className?: string;
}

export default function ProductVariantSelector({ product, className }: ProductVariantSelectorProps) {
  if (isVariantConfiguratorProduct(product)) {
    return <ProductVariantConfigurator product={product} className={className} />;
  }

  const soloVariant = product.variantAttributes?.length === 1 ? product.variantAttributes[0] : null;

  if (soloVariant) {
    return <ProductVariantSelectorSimple product={product} soloVariant={soloVariant} className={className} />;
  }

  return <ProductVariantSelectorMulti product={product} className={className} />;
}
