import { useTranslations } from 'next-intl';
import { ArrowRight, Package } from 'lucide-react';
import { Cart } from '@/platform/services/model/cart';
import { CardContent } from '../ui/card';
import UiLink from '../ui/link';

interface CartSummaryProps {
  cart: Cart;
}
export function CartFreeship({ cart }: CartSummaryProps) {
  const t = useTranslations('cart');
  const freeShippingValue = 400;

  return (
    <CardContent className="flex flex-col gap-2 bg-surface-action-hover-2 rounded-md p-3">
      <div className="flex gap-2 text-text-action">
        <Package />
        <div className="font-bold font-headlines text-text-headings">
          {(freeShippingValue - cart.totalPrice.amount).toFixed(2) + t('untilFreeShipping')}
        </div>
      </div>
      <div className="rounded-lg h-4 border border-border-primary">
        <div
          className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start rounded-[inherit] h-full"
          style={{ width: ((100 / freeShippingValue) * cart.totalPrice.amount).toFixed(0) + '%' }}
        ></div>
      </div>
      <span className="text-text-action">{t('freeShippingOn')}</span>
      <UiLink type="Link" href="#" variant="primary" size="m" iconAfter={<ArrowRight />}>
        {t('continueShopping')}
      </UiLink>
    </CardContent>
  );
}
