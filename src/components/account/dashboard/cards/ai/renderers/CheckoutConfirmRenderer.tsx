'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useSite } from '@/hooks/site/useSite';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { formatCurrency } from '@/lib/utils';
import type { CheckoutAddress } from '@/platform/services/model/checkout';
import { AiAddress, AiWidgetFooterLink, AiWidgetFrame, AiWidgetHeader, AiWidgetSection } from './ai-widget-kit';

const toAiAddress = (address: CheckoutAddress) => ({
  name: address.contactName,
  company: address.companyName && address.companyName !== address.contactName ? address.companyName : undefined,
  addressLine1: [address.street, address.streetNumber?.trim()].filter(Boolean).join(' '),
  addressLine2: address.streetAppendix,
  postalCode: address.zipCode,
  city: address.city,
  state: address.state,
  country: address.country,
});

const optionRowClass = 'flex cursor-pointer items-center gap-3 py-1.5 text-sm text-text-body';

/**
 * Places the order through the storefront checkout (full address objects, legal-entity locations
 * included) with the addresses the shopper picked in the chat.
 */
export const CheckoutConfirmRenderer: React.FC = () => {
  const t = useTranslations('checkout.aiCheckout');
  const tPayment = useTranslations('checkout.PaymentModes');
  const {
    checkoutCart,
    shippingAddress,
    billingAddress,
    availableShippingMethods,
    shippingMethodsLoading,
    shippingMethod,
    submitShippingMethod,
    paymentMethod,
    submitPaymentMethod,
    processCheckout,
    loading,
    error,
  } = useCheckout();
  const { paymentModes } = useSite();
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  if (placedOrderId) {
    return (
      <AiWidgetFrame>
        <AiWidgetHeader title={t('success', { orderId: placedOrderId })} />
        <AiWidgetFooterLink href={`/account/orders/${placedOrderId}`} testId="aiCheckout-viewOrder">
          {t('viewOrder')}
        </AiWidgetFooterLink>
      </AiWidgetFrame>
    );
  }

  const activePaymentModes = (paymentModes ?? []).filter((mode) => mode.active !== false);
  const canPlaceOrder = Boolean(
    checkoutCart && shippingAddress && billingAddress && shippingMethod && paymentMethod && !loading,
  );

  const placeOrder = async () => {
    const response = await processCheckout();
    if (response?.orderId) {
      setPlacedOrderId(response.orderId);
    }
  };

  return (
    <AiWidgetFrame>
      <AiWidgetHeader title={t('title')} />

      {shippingAddress && billingAddress ? (
        <AiWidgetSection>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-text-headings">{t('shippingAddress')}</p>
              <AiAddress address={toAiAddress(shippingAddress)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-text-headings">{t('billingAddress')}</p>
              <AiAddress address={toAiAddress(billingAddress)} />
            </div>
          </div>
        </AiWidgetSection>
      ) : (
        <AiWidgetSection>
          <p className="text-sm text-text-body">{t('missingAddresses')}</p>
        </AiWidgetSection>
      )}

      <AiWidgetSection label={t('shippingMethod')}>
        {shippingMethodsLoading ? <p className="text-sm text-text-body">{t('loading')}</p> : null}
        {!shippingMethodsLoading && availableShippingMethods.length === 0 ? (
          <p className="text-sm text-text-body">{t('noShippingMethods')}</p>
        ) : null}
        {!shippingMethodsLoading && availableShippingMethods.length > 0 ? (
          <RadioGroup
            value={shippingMethod?.methodId ?? ''}
            onValueChange={(id) =>
              submitShippingMethod(availableShippingMethods.find((method) => method.id === id) ?? null)
            }
            data-testid="aiCheckout-shippingMethodGroup"
          >
            {availableShippingMethods.map((method) => (
              <label key={method.id} className={optionRowClass}>
                <RadioGroupItem value={method.id} data-testid={`aiCheckout-shippingMethod-${method.id}`} />
                <span className="flex-1">{method.name}</span>
                {method.cost ? (
                  <span className="tabular-nums">{formatCurrency(method.cost.amount, method.cost.currency)}</span>
                ) : null}
              </label>
            ))}
          </RadioGroup>
        ) : null}
      </AiWidgetSection>

      {activePaymentModes.length > 0 ? (
        <AiWidgetSection label={t('paymentMethod')}>
          <RadioGroup
            value={paymentMethod?.id ?? ''}
            onValueChange={(id) => {
              const mode = activePaymentModes.find((candidate) => candidate.id === id);
              if (mode) {
                submitPaymentMethod({ ...mode, provider: 'none' });
              }
            }}
            data-testid="aiCheckout-paymentMethodGroup"
          >
            {activePaymentModes.map((mode) => (
              <label key={mode.id} className={optionRowClass}>
                <RadioGroupItem value={mode.id} data-testid={`aiCheckout-paymentMethod-${mode.code}`} />
                <span>{tPayment(dk<PaymentModeKey>(mode.code))}</span>
              </label>
            ))}
          </RadioGroup>
        </AiWidgetSection>
      ) : null}

      <AiWidgetSection className="flex flex-wrap items-center justify-between gap-3">
        {error ? <p className="w-full text-sm text-text-error">{t('error')}</p> : null}
        <Button onClick={placeOrder} disabled={!canPlaceOrder} data-testid="aiCheckout-placeOrder">
          {loading ? t('placing') : t('placeOrder')}
        </Button>
      </AiWidgetSection>

      <AiWidgetFooterLink href="/checkout" testId="aiCheckout-openCheckout">
        {t('openCheckout')}
      </AiWidgetFooterLink>
    </AiWidgetFrame>
  );
};
