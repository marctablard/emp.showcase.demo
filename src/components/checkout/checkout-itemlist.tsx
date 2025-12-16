import { useTranslations } from 'next-intl';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { CartItemRow } from '../cart/cart-item';
import { Card, CardContent, CardHeader } from '../ui/card';
import { H2 } from '../ui/h';

export function CheckoutItemlist() {
  const { checkoutCart } = useCheckout();
  const t = useTranslations('checkout');

  return (
    <Card className="p-0 border-none mb-6 gap-3">
      <CardHeader className="pt-6 hidden sm:block">
        <div className="grid grid-cols-[120px_2fr_1fr_1fr] md:grid-cols-[120px_3fr_1fr_1fr]">
          <H2 variant="h5" className="col-start-1 font-bold">
            {t('products')}
          </H2>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        {checkoutCart?.items.map((item) => (
          <CartItemRow key={item.id} cart={checkoutCart} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
