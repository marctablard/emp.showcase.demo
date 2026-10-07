import { coalesceBrandLabel, resolveProductBrandLabel } from '@/components/product/resolve-product-brand';
import { useProducts } from '@/hooks/product/useProducts';
import { useL10n } from '@/hooks/useL10n';
import type { ProductListItem, ProductListPresentationConfig } from './product-list';
import { ProductList } from './product-list';

export interface ProductMinimal {
  /** Stable row id (order/return line id); falls back to productId when omitted. */
  id?: string;
  productId?: string;
  itemYrn?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  grossUnitPrice?: number;
  netUnitPrice?: number;
  baseNetUnitPrice?: number;
  discountPercent?: number;
  /** Snapshot name (order/return); preferred over catalog name when set. */
  name?: string;
  /** Snapshot brand; preferred when set, otherwise resolved from catalog. */
  brand?: string;
  itemNumber?: string;
  imageUrl?: string | null;
  href?: string;
}

interface ProductListResolverProps {
  readonly items: ProductMinimal[];
  readonly className?: string;
  readonly locale?: string;
  readonly presentationConfig?: ProductListPresentationConfig;
  readonly showGrossUnderNet?: boolean;
}

const extractProductIdFromYrn = (yrn?: string) => {
  if (!yrn) return undefined;
  const parts = yrn.split(';');
  return parts[parts.length - 1] || yrn;
};

function resolveProductHref(itemHref: string | undefined, productId: string | undefined, fallbackPid?: string) {
  if (itemHref) {
    return itemHref;
  }
  const id = productId || fallbackPid;
  return id ? `/product/${id}` : undefined;
}

function resolveProductImageUrl(
  itemImageUrl: string | null | undefined,
  catalogImageUrl: string | undefined,
): string | null {
  if (itemImageUrl !== undefined) {
    return itemImageUrl;
  }
  return catalogImageUrl || null;
}

export function ProductListResolver({
  items,
  className,
  locale,
  presentationConfig,
  showGrossUnderNet,
}: ProductListResolverProps) {
  const { l10n } = useL10n();
  const productIds = (items || [])
    .map((it) => it.productId || extractProductIdFromYrn(it.itemYrn))
    .filter(Boolean) as string[];

  const { products } = useProducts(productIds);
  const productById = Object.fromEntries((products || []).map((p) => [p.id, p]));

  const listItems: ProductListItem[] = items.map((it, idx) => {
    const pid = (it.productId || extractProductIdFromYrn(it.itemYrn)) as string | undefined;
    const product = pid ? productById[pid] : undefined;
    const catalogName = product?.name ? l10n(product.name) : '';
    const name = it.name?.trim() || catalogName || pid || '';
    const brand = coalesceBrandLabel(it.brand, resolveProductBrandLabel(product, l10n));
    return {
      id: it.id || pid || `${it.itemYrn || idx}`,
      name,
      brand,
      itemNumber: it.itemNumber || pid || it.itemYrn,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      currency: it.currency,
      grossUnitPrice: it.grossUnitPrice,
      netUnitPrice: it.netUnitPrice,
      baseNetUnitPrice: it.baseNetUnitPrice,
      discountPercent: it.discountPercent,
      imageUrl: resolveProductImageUrl(it.imageUrl, product?.images?.[0]?.url),
      href: resolveProductHref(it.href, product?.id, pid),
    };
  });

  return (
    <ProductList
      items={listItems}
      className={className}
      locale={locale}
      presentationConfig={presentationConfig}
      showGrossUnderNet={showGrossUnderNet}
    />
  );
}
