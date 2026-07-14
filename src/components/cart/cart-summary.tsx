import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LockKeyhole } from 'lucide-react';
import { CartPriceBreakdown } from '@/components/cart/cart-price-breakdown';
import { PromoCodeInput } from '@/components/cart/promo-code-input';
import { H5 } from '@/components/ui/h';
import { useElementScroll } from '@/hooks/ui/useElementScroll';
import { cn } from '@/lib/utils';
import type { Cart } from '@/platform/services/model/cart';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import UiLink from '../ui/link';
import { CartRequest } from './cart-request';

interface CartSummaryProps {
  cart: Cart;
  boundingContent: RefObject<HTMLDivElement | null>;
}

export function CartSummary({ cart, boundingContent }: CartSummaryProps) {
  const t = useTranslations('cart.summary');
  //const freeShippingValue = 400;

  const fixedContainer = useRef<HTMLDivElement>(null);
  const topPosition = 112;
  const { isFixed, isFixedToTop, isContainerBottom } = useElementScroll(fixedContainer, topPosition, boundingContent);

  return (
    <div className="col-span-1 lg:col-span-1 mb-6 flex">
      <div className={cn('flex flex-col w-full', isContainerBottom ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'flex flex-col gap-4',
            isFixed ? 'fixed md:mr-9' : '',
            isFixedToTop ? 'top-[112px]' : 'bottom-[40px]',
          )}
          ref={fixedContainer}
        >
          <Card className="bg-surface-action-hover-2 p-6 border-none gap-4 shadow-sm md:max-w-[438px] w-full">
            <CardHeader className="p-0">
              <CardTitle>
                <H5>{t('title')}</H5>
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-surface-page rounded-md p-4">
              <div className="space-y-4">
                <PromoCodeInput />
                <CartPriceBreakdown cart={cart} hideShippingUntilSelected />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col p-0">
              <UiLink
                variant="buttonPrimary"
                type="Link"
                href="/checkout"
                className="w-full"
                data-testid="cart-goToCheckout"
              >
                {t('goToCheckout')}
              </UiLink>
              <div className="flex align-center gap-2 text-text-on-disabled pt-4">
                <div>
                  <LockKeyhole width={12} />
                </div>
                <div className="text-sm leading-6">{t('dataTransmittedSecure')}</div>
              </div>
            </CardFooter>
          </Card>
          <CartRequest />
        </div>
      </div>
    </div>
  );
}
