import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { H6 } from '@/components/ui/h';
import { ProductItemRow } from './product-item-row';

export interface ProductListItem {
  id: string;
  name: string;
  brand?: string;
  itemNumber?: string; // product code / SKU
  quantity: number;
  unitPrice: number;
  currency: string;
  grossUnitPrice?: number;
  netUnitPrice?: number;
  imageUrl?: string | null;
  href?: string; // optional product link
}

interface ProductListProps {
  readonly items: ProductListItem[];
  readonly className?: string;
  readonly showNetUnderGross?: boolean;
}

export function ProductList({ items, className, showNetUnderGross = false }: ProductListProps) {
  const tCart = useTranslations('cart');
  const tQuoteDetails = useTranslations('account.quoteDetails');

  return (
    <Card className={`border border-border-primary shadow-sm ${className || ''}`}>
      <CardContent className="p-6">
        <div className="hidden sm:grid grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] items-start gap-6 border-b border-border-primary pb-4">
          <H6 className="text-sm font-bold text-text-headings">{tCart('product')}</H6>
          <H6 className="text-left text-sm font-bold text-text-headings">{tQuoteDetails('quantity')}</H6>
          <H6 className="text-right text-sm font-bold text-text-headings">{tQuoteDetails('unitPrice')}</H6>
        </div>
        <div className="divide-y divide-border-primary">
          {items.map((item) => (
            <ProductItemRow key={item.id} item={item} showNetUnderGross={showNetUnderGross} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
