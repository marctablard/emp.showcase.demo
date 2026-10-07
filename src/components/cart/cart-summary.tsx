import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { BadgePercent, Info, LockKeyhole } from 'lucide-react';
import { CheckoutGoodsTotals, CheckoutShippingFeeValue } from '@/components/checkout/checkout-summary-figures';
import { H5 } from '@/components/ui/h';
import { TruncatedText } from '@/components/ui/truncated-text';
import { useCartTotal } from '@/hooks/cart/useCartTotal';
import { useElementScroll } from '@/hooks/ui/useElementScroll';
import { isFreeShippingPromo, shopperFacingCartPromos } from '@/lib/common/applied-promo-display';
import type { CheckoutOrderSummaryBreakdown } from '@/lib/common/checkout-order-summary';
import { cn, formatCurrency } from '@/lib/utils';
import type { Cart, CartAppliedDiscount } from '@/platform/services/model/cart';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import UiLink from '../ui/link';
import { CartRequest } from './cart-request';

interface CartSummaryProps {
  cart: Cart;
  boundingContent: RefObject<HTMLDivElement | null>;
  onRequestQuote: () => void;
}

function CartAppliedPromoList({
  discounts,
  currency,
}: Readonly<{ discounts: CartAppliedDiscount[] | undefined; currency: string }>) {
  const t = useTranslations('checkout.summary');
  const visible = shopperFacingCartPromos(discounts);
  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 rounded-md border border-border-success bg-surface-success px-4 py-2">
      {visible.map((discount) => (
        <div
          key={`${discount.code}-${discount.discountIndex}`}
          className="flex w-full min-w-0 flex-col gap-0.5"
          data-testid={`cart-appliedPromo-${discount.code}`}
        >
          <div className="flex min-w-0 items-center gap-1">
            <BadgePercent className="size-[18px] shrink-0 text-icon-success" aria-hidden />
            <TruncatedText text={discount.code} className="text-sm leading-5 text-text-body" />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 text-sm leading-5 text-text-body">
            {discount.name ? (
              <TruncatedText text={discount.name} className="font-normal text-sm leading-5 text-text-body" />
            ) : (
              <span />
            )}
            <p
              className="shrink-0 text-right text-sm font-normal leading-5"
              data-testid={`cart-appliedPromoAmount-${discount.code}`}
            >
              {isFreeShippingPromo(discount)
                ? t('promoFreeShipping')
                : formatCurrency(-Math.abs(discount.amount), discount.currency || currency)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * COP-6688: once a coupon is already on the cart, the summary matches checkout
 * (struck goods or shipping, savings, coupon rows). Add and remove stay on checkout.
 */
function CartCouponSummary({
  cart,
  breakdown,
  currency,
}: Readonly<{ cart: Cart; breakdown: CheckoutOrderSummaryBreakdown; currency: string }>) {
  const t = useTranslations('cart.summary');
  const tCheckout = useTranslations('checkout.summary');
  const tCommon = useTranslations('common');
  const moneyCurrency = currency || cart.tax.currency;
  const isGrossApplied = breakdown.couponApplyBasis === 'gross' && (breakdown.goodsDiscounted ?? true);

  return (
    <>
      <div
        className="flex gap-1 rounded-md border border-border-secondary bg-surface-primary px-4 py-2"
        data-testid="cart-summary-promoApplied"
      >
        <Info className="size-[18px] shrink-0 text-text-action" aria-hidden />
        <p className="min-w-0 text-sm leading-5 text-text-body">
          <span className="font-bold">{t('promoAppliedTitle')}</span>
          <br />
          {t('promoAppliedInfo')}
        </p>
      </div>
      <CartAppliedPromoList discounts={cart.discounts} currency={moneyCurrency} />
      <CardContent className="bg-surface-page rounded-md p-4">
        <div className="space-y-4">
          <CheckoutGoodsTotals
            breakdown={breakdown}
            isGrossApplied={isGrossApplied}
            moneyCurrency={moneyCurrency}
            fallbackGross={cart.tax.grossValue}
            idleGoodsAmount={cart.subTotalPrice.amount}
            idleGoodsCurrency={cart.subTotalPrice.currency}
            idPrefix="cart"
          />
          <div className="flex flex-col gap-2">
            {!isGrossApplied && (
              <div className="flex justify-between text-base">
                <span>{tCommon('tax')}</span>
                <span>{formatCurrency(breakdown.goodsVat, moneyCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base">
              <span>{tCheckout('shippingFee')}</span>
              <CheckoutShippingFeeValue
                shippingFee={breakdown.shippingFee}
                shippingFree={breakdown.shippingFree === true}
                currency={moneyCurrency}
                idPrefix="cart"
              />
            </div>
            {breakdown.showShippingVat && (
              <div className="flex justify-between text-base" data-testid="cart-summary-shipping-vat">
                <span>{tCheckout('shippingVat')}</span>
                <span>{formatCurrency(breakdown.shippingVat, moneyCurrency)}</span>
              </div>
            )}
            {cart.fees && (
              <div className="flex justify-between text-base">
                <span>{tCheckout('fees')}</span>
                <span>{formatCurrency(breakdown.feesTotal, currency || cart.fees.currency)}</span>
              </div>
            )}
            <div className="flex justify-between" data-testid="cart-summary-total">
              <H5>{tCheckout('total')}</H5>
              <H5>{formatCurrency(breakdown.total, moneyCurrency)}</H5>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
}

export function CartSummary({ cart, boundingContent, onRequestQuote }: Readonly<CartSummaryProps>) {
  const t = useTranslations('cart.summary');
  const tCommon = useTranslations('common');
  //const freeShippingValue = 400;

  const fixedContainer = useRef<HTMLDivElement>(null);
  const topPosition = 112;
  const { isFixed, isFixedToTop, isContainerBottom } = useElementScroll(fixedContainer, topPosition, boundingContent);
  const {
    cartTotal,
    goodsGross,
    goodsNet,
    goodsVat,
    shippingCosts,
    shippingVat,
    showShippingVat,
    currency,
    breakdown,
  } = useCartTotal();
  // COP-6688: a hidden rollup (TOTAL), an invalid row, or a zero-effect row is not a coupon
  // the shopper can see. Keep the idle note unless a shopper-facing code is actually listed.
  const showAppliedCoupons =
    breakdown?.hasAppliedCoupons === true && shopperFacingCartPromos(cart.discounts).length > 0;

  return (
    <div className="mb-6 flex">
      <div className={cn('flex flex-col w-full', isContainerBottom ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'flex flex-col gap-4',
            isFixed ? 'lg:fixed lg:w-[444px]' : '',
            isFixedToTop ? 'lg:top-[112px]' : 'lg:bottom-[40px]',
          )}
          ref={fixedContainer}
        >
          <Card className="bg-surface-action-hover-2 p-6 border-none gap-4 shadow-sm w-full">
            <CardHeader className="p-0">
              <CardTitle>
                <H5>{t('title')}</H5>
              </CardTitle>
            </CardHeader>
            {showAppliedCoupons ? (
              <CartCouponSummary cart={cart} breakdown={breakdown} currency={currency} />
            ) : (
              <CardContent className="bg-surface-page rounded-md p-4">
                <div className="space-y-4">
                  <div className="flex gap-2 text-text-action">
                    <div>
                      <Info />
                    </div>
                    <div className="text-base">{t('promoCodeInfo')}</div>
                  </div>
                  <div className="flex justify-between">
                    <span className="">{t('valueOfGoods')}</span>
                    <span>{formatCurrency(goodsGross, currency)}</span>
                  </div>

                  <div className="flex justify-between text-base pt-4 border-t border-border-primary">
                    <span>{t('netValueOfGoods')}</span>
                    <span className="font-bold font-headlines">{formatCurrency(goodsNet, currency)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-base">
                      <span>{tCommon('tax')}</span>
                      <span>{formatCurrency(goodsVat, currency)}</span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span>{t('shippingCosts')}</span>
                      {shippingCosts === undefined ? (
                        <span>{t('calculatedAtCheckout')}</span>
                      ) : (
                        <span>{formatCurrency(shippingCosts, currency)}</span>
                      )}
                    </div>
                    {showShippingVat && (
                      <div className="flex justify-between text-base" data-testid="cart-summary-shipping-vat">
                        <span>{t('shippingVat')}</span>
                        <span>{formatCurrency(shippingVat, currency)}</span>
                      </div>
                    )}
                  </div>
                  {/*isDelivery && freeShippingValue - cart.totalPrice.amount > 0 && <CartFreeship cart={cart} />*/}
                  <div className="flex flex-col gap-2">
                    {cart.fees && (
                      <div className="flex justify-between text-base">
                        <span>{t('fees')}</span>
                        <span>{formatCurrency(cart.fees.amount, cart.fees.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold font-headlines text-lg">
                      <span>{t('total')}</span>
                      <span>{formatCurrency(cartTotal, currency)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
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
          <CartRequest onRequestQuote={onRequestQuote} />
        </div>
      </div>
    </div>
  );
}
