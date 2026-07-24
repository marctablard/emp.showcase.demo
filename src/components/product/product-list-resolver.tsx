import { useProducts } from '@/hooks/product/useProducts';
import { useL10n } from '@/hooks/useL10n';
import type { ProductListItem } from './product-list';
import { ProductList } from './product-list';

export interface ProductMinimal {
  productId?: string;
  itemYrn?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  grossUnitPrice?: number;
  netUnitPrice?: number;
}

interface ProductListResolverProps {
  items: ProductMinimal[];
  className?: string;
  showNetUnderGross?: boolean;
}

const extractProductIdFromYrn = (yrn?: string) => {
  if (!yrn) return undefined;
  const parts = yrn.split(';');
  return parts[parts.length - 1] || yrn;
};

export function ProductListResolver({ items, className, showNetUnderGross }: ProductListResolverProps) {
  const { l10n } = useL10n();
  const productIds = (items || [])
    .map((it) => it.productId || extractProductIdFromYrn(it.itemYrn))
    .filter(Boolean) as string[];

  const { products } = useProducts(productIds);
  const productById = Object.fromEntries((products || []).map((p) => [p.id, p]));

  const listItems: ProductListItem[] = items.map((it, idx) => {
    const pid = (it.productId || extractProductIdFromYrn(it.itemYrn)) as string | undefined;
    const product = pid ? productById[pid] : undefined;
    const name: string = product?.name ? l10n(product.name) : '';
    const brand: string | undefined = l10n(
      product?.brand?.name || product?.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
    );
    return {
      id: pid || `${it.itemYrn || idx}`,
      name,
      brand,
      itemNumber: pid || it.itemYrn,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      currency: it.currency,
      grossUnitPrice: it.grossUnitPrice,
      netUnitPrice: it.netUnitPrice,
      imageUrl: product?.images?.[0]?.url || null,
      href: product?.id ? `/product/${product.id}` : undefined,
    };
  });

  return <ProductList items={listItems} className={className} showNetUnderGross={showNetUnderGross} />;
}
