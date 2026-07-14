import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import type { Cart } from '@platform/services/model/cart';
import { CartPriceBreakdown } from '@/components/cart/cart-price-breakdown';
import { HeaderMiniCartItemList } from '@/components/header/cart/header-mini-cart-item-list';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface HeaderMiniCartContentProps {
  loading: boolean;
  cart?: Cart | null;
  scrollHeight: boolean;
  scrollContainer: RefObject<HTMLDivElement | null>;
}

export function HeaderMiniCartContent({ loading, cart, scrollHeight, scrollContainer }: HeaderMiniCartContentProps) {
  const t = useTranslations('cart');
  const router = useRouter();

  return (
    <>
      {loading ? (
        <div className="pr-4 pt-4 flex items-center justify-center">
          <Spinner color="primary" variant="md" />
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-text-placeholders">{t('emptyCart')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 justify-center rounded-md pt-4">
          <div
            className={cn(scrollHeight ? 'overflow-y-scroll pr-0.5' : 'pr-4', 'max-h-[300px]')}
            ref={scrollContainer}
          >
            <HeaderMiniCartItemList cart={cart} />
          </div>
          {cart && (
            <div className="pr-4">
              <CartPriceBreakdown
                cart={cart}
                className="gap-2"
                rowClassName="text-sm"
                totalClassName="text-base"
                hideShippingUntilSelected
              />
            </div>
          )}
          <div className="pr-4">
            <Button className="w-full" onClick={() => router.push('/cart')}>
              {t('viewCart')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
