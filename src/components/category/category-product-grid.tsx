'use client';

import { ProductTile } from '@/components/product/product-tile';
import { useSessionPricedProducts } from '@/hooks/product/useSessionPricedProducts';
import type { Product } from '@/platform/services/model/product';

interface CategoryProductGridProps {
  products: Product[];
  locale?: string;
}

export function CategoryProductGrid({ products: initialProducts, locale = 'en' }: CategoryProductGridProps) {
  const { products } = useSessionPricedProducts(initialProducts);

  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductTile key={product.id} product={product} locale={locale} skipVariantFetch />
      ))}
    </div>
  );
}
