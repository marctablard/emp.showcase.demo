import { useTranslations } from 'next-intl';
import type { Cart } from '@/platform/services/model/cart';
import { Card, CardContent, CardHeader } from '../ui/card';
import { CartItemRow } from './cart-item';

interface CartItemListProps {
  cart: Cart;
}

export function CartItemList({ cart }: Readonly<CartItemListProps>) {
  const t = useTranslations('cart');

  return (
    <Card className="p-0 shadow-sm border-none md:mb-6 gap-3">
      <CardHeader className="pt-6 hidden sm:block">
        <div className="grid sm:grid-cols-[120px_minmax(0,1fr)_auto_1.5rem_auto]">
          <p className="col-start-1 col-end-3 font-bold font-headlines">{t('product')}</p>
          <p className="sm:col-start-3 sm:row-start-1 font-bold font-headlines">{t('qty')}</p>
          <p className="sm:col-start-5 font-bold font-headlines text-end">{t('price')}</p>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        {cart?.items.map((item) => (
          <CartItemRow key={item.id} cart={cart} item={item} showQty={true} />
        ))}
      </CardContent>
    </Card>
  );
}
