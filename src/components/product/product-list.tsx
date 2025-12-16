import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ProductItemRow } from './product-item-row';

export interface ProductListItem {
  id: string;
  name: string;
  brand?: string;
  itemNumber?: string; // product code / SKU
  quantity: number;
  unitPrice: number;
  currency: string;
  imageUrl?: string | null;
  href?: string; // optional product link
}

interface ProductListProps {
  items: ProductListItem[];
  className?: string;
  showNetUnderGross?: boolean;
}

export function ProductList({ items, className, showNetUnderGross = false }: ProductListProps) {
  const tCart = useTranslations('cart');

  return (
    <Card className={`p-0 shadow-sm border-none md:mb-6 gap-3 ${className || ''}`}>
      <CardHeader className="pt-6 hidden sm:block">
        <div className="grid grid-cols-[1fr_2fr] sm:grid-cols-[120px_2fr_1fr_1fr] md:grid-cols-[120px_3fr_1fr_1fr]">
          <p className="col-start-1 col-end-3 font-bold font-headlines">{tCart('product')}</p>
          <p className="col-start-2 row-start-4 sm:col-start-3 sm:col-end-3 sm:row-start-1 md:col-start-3 font-bold font-headlines">
            {tCart('qty')}
          </p>
          <p className="col-start-4 lg:col-start-4 font-bold font-headlines text-end">{tCart('price')}</p>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        {items.map((item) => (
          <ProductItemRow key={item.id} item={item} showNetUnderGross={showNetUnderGross} />
        ))}
      </CardContent>
    </Card>
  );
}
