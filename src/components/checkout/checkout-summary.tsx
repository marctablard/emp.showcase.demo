'use client';

import type { RefObject } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LockKeyhole } from 'lucide-react';
import { useApprovalCheckout } from '@/hooks/approval/useApprovalCheckout';
import { useIsCartMutating } from '@/hooks/cart/useIsCartMutating';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useCheckoutOrderSummary } from '@/hooks/checkout/useCheckoutOrderSummary';
import { useElementScroll } from '@/hooks/ui/useElementScroll';
import { useValidator } from '@/hooks/validation/useValidator';
import { createCheckoutApprovalContext } from '@/lib/approval/contracts';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { H5 } from '../ui/h';
import { ToastType, notify } from '../ui/toast-notification';
import { ApprovalModal } from './approval-modal';
import { CheckoutPromoCodeBox } from './checkout-promo-code';
import { CheckoutGoodsTotals, CheckoutShippingFeeValue } from './checkout-summary-figures';
import { focusFirstInvalid, useCheckoutValidation, useRegisterCheckoutForm } from './checkout-validation-registry';

interface OrderSummaryProps {
  isReadOnly?: boolean;
  leftContent: RefObject<HTMLDivElement | null>;
  onSubmit: (approvalData?: { approverId: string; comment: string }) => void;
}

/**
 * Order summary component for checkout
 * Displays cart items, subtotal, shipping, and total
 */
const CheckoutSummaryComponent: React.FC<OrderSummaryProps> = ({ leftContent, onSubmit }) => {
  const {
    checkoutCart: cart,
    loading: checkoutLoading,
    shippingAddress,
    shippingMethod,
    availableShippingMethods = [],
    shippingMethodsLoading = false,
  } = useCheckout();
  const { requiresApproval, loading: approvalLoading, setCartId } = useApprovalCheckout(cart?.id?.toString());
  const cartMutating = useIsCartMutating();
  const loading = checkoutLoading || approvalLoading;
  const t = useTranslations('checkout.summary');
  const tCommon = useTranslations('common');
  const tCheckout = useTranslations('checkout');
  const tShipping = useTranslations('checkout.shipping');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disabled, setDisabled] = useState(true);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const { validateAll } = useCheckoutValidation();

  const onValidationSuccess = (data: any) => {
    setDisabled(!data.termsAndConditions);
  };

  const approvalSubmit = async (approverId: string, comment: string) => {
    await onSubmit({ approverId, comment });
    setIsApprovalModalOpen(false);
  };

  useEffect(() => {
    if (cart) {
      setCartId(cart.id);
    }
  }, [cart, setCartId]);

  const { form } = useValidator(
    'SummaryValidationService',
    {
      termsAndConditions: false,
    },
    'onChange',
    onValidationSuccess,
  );

  const summaryRootRef = useRef<HTMLDivElement>(null);
  useRegisterCheckoutForm('summary-terms', form, summaryRootRef);

  const fixedContainer = useRef<HTMLDivElement>(null);
  // 112 = pinned top offset (`top-[112px]` below) — trigger and pin must use the same value.
  const { isFixed, isFixedToTop, isContainerBottom } = useElementScroll(fixedContainer, 112, leftContent);
  const summary = useCheckoutOrderSummary();
  const {
    goodsVat,
    shippingFee,
    shippingVat,
    showShippingVat,
    shippingVatLookupFailed,
    feesTotal,
    total,
    currency,
    hasAppliedCoupons,
    couponApplyBasis,
    goodsDiscounted,
    shippingFree,
  } = summary;
  // Missing couponApplyBasis stays on the shipped net-applied path (COP-4815).
  // The gross stack only makes sense when goods were actually discounted (COP-5589 QA: free shipping).
  const isGrossApplied = Boolean(hasAppliedCoupons) && couponApplyBasis === 'gross' && (goodsDiscounted ?? true);
  if (!cart) {
    return (
      <div className="bg-surface-page p-6 rounded-md shadow-sm">
        <H5 className="mb-4">{t('title')}</H5>
      </div>
    );
  }

  const moneyCurrency = currency || cart.tax.currency;
  const idleSubmitLabel = requiresApproval ? t('inquireForApproval') : t('submitOrder');
  const submitLabel = isSubmitting || loading ? t('processing') : idleSubmitLabel;

  return (
    <div className={cn('flex flex-col gap-4 w-full', isContainerBottom ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex flex-col gap-4',
          isFixed ? 'lg:fixed lg:w-[444px]' : '',
          isFixedToTop ? 'lg:top-[112px]' : 'lg:bottom-[40px]',
        )}
        ref={fixedContainer}
      >
        <Card className={cn('bg-surface-action-hover-2 p-6 border-none gap-4 w-full')} ref={summaryRootRef}>
          {/* COP-4815 / Figma 4452:97361: title box is 24px; Card gap-4 is spacing/4 (16px) to Input Button. Collapse CardHeader's default grid-rows-[auto_auto] + gap-1.5 so the extra 6px row is gone. */}
          <CardHeader className="grid-rows-[auto] gap-0 p-0">
            <CardTitle>
              <H5>{t('title')}</H5>
            </CardTitle>
          </CardHeader>
          <CheckoutPromoCodeBox />
          <CardContent className="bg-surface-page rounded-md p-4">
            <div className="space-y-4">
              {/* COP-5589: net-applied original/savings. COP-4815: after-tax stack is Jira AC — Figma 4517:46711 is net + separator only. */}
              <CheckoutGoodsTotals
                breakdown={summary}
                isGrossApplied={isGrossApplied}
                moneyCurrency={moneyCurrency}
                fallbackGross={cart.tax.grossValue}
                idleGoodsAmount={cart.subTotalPrice.amount}
                idleGoodsCurrency={cart.subTotalPrice.currency}
              />
              <div className="flex flex-col gap-2">
                {!isGrossApplied && (
                  <div className="flex justify-between text-base">
                    <span>{tCommon('tax')}</span>
                    <span>{formatCurrency(goodsVat, moneyCurrency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <span>{t('shippingFee')}</span>
                  <CheckoutShippingFeeValue
                    shippingFee={shippingFee}
                    shippingFree={shippingFree === true}
                    currency={currency || cart.currency}
                  />
                </div>
                {/* Shipping VAT is a Jira override — Figma Order Overview has no Shipping VAT line and shows Freight Costs instead. */}
                {showShippingVat && (
                  <div className="flex justify-between text-base" data-testid="checkout-summary-shipping-vat">
                    <span>{t('shippingVat')}</span>
                    <span>{formatCurrency(shippingVat, currency || cart.currency)}</span>
                  </div>
                )}
                {cart.fees && (
                  <div className="flex justify-between text-base">
                    <span>{t('fees')}</span>
                    <span>{formatCurrency(feesTotal, currency || cart.fees.currency)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between"
                  data-testid="checkout-summary-total"
                  {...(shippingVatLookupFailed ? { 'data-shipping-vat-lookup-failed': 'true' } : {})}
                >
                  <H5>{t('total')}</H5>
                  {!shippingVatLookupFailed && <H5>{formatCurrency(total, currency || cart.currency)}</H5>}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col p-0">
            <Form {...form}>
              <FormField
                control={form.control}
                name="termsAndConditions"
                render={({ field }) => (
                  <FormItem className="flex flex-row gap-3 pb-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="bg-surface-page"
                        data-testid="checkout-termsAndConditions"
                      />
                    </FormControl>
                    <FormLabel className="font-medium leading-6">{t('termsAndConditions')}</FormLabel>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                onClick={async (e) => {
                  e.preventDefault();
                  if (isSubmitting || loading || cartMutating) {
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    const { valid, firstInvalid } = await validateAll();
                    const hasAddress = Boolean(shippingAddress?.country?.trim() && shippingAddress?.zipCode?.trim());
                    if (!hasAddress) {
                      notify({ type: ToastType.Error, title: tShipping('enterShippingAddressFirst') });
                      focusFirstInvalid(firstInvalid);
                      return;
                    }
                    if (shippingMethodsLoading) {
                      notify({ type: ToastType.Error, title: tShipping('loading') });
                      return;
                    }
                    if (availableShippingMethods.length === 0) {
                      notify({ type: ToastType.Error, title: tShipping('noShippingMethodsAvailable') });
                      focusFirstInvalid(firstInvalid);
                      return;
                    }
                    if (!shippingMethod) {
                      notify({ type: ToastType.Error, title: tShipping('selectShippingMethod') });
                      focusFirstInvalid(firstInvalid);
                      return;
                    }
                    if (!valid) {
                      notify({ type: ToastType.Error, title: tCheckout('formErrors') });
                      focusFirstInvalid(firstInvalid);
                      return;
                    }
                    if (requiresApproval) {
                      setIsApprovalModalOpen(true);
                    } else {
                      onSubmit();
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={disabled || isSubmitting || loading || approvalLoading || cartMutating}
                className="w-full"
                data-testid="checkout-submitOrder"
              >
                {submitLabel}
              </Button>
            </Form>
            <div className="flex align-center gap-2 text-text-on-disabled pt-4">
              <div>
                <LockKeyhole width={12} />
              </div>
              <div className="text-sm">{t('dataTransmittedSecure')}</div>
            </div>

            {/* Approval Modal */}
            {cart && (
              <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                resourceContext={createCheckoutApprovalContext(cart.id)}
                approvalSubmit={approvalSubmit}
              />
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CheckoutSummaryComponent;
