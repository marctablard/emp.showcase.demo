'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AddressSelector } from '@/components/address/address-selector';
import CheckoutAddress from '@/components/checkout/checkout-address';
import ShippingMethod from '@/components/checkout/shipping-method';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useAddresses } from '@/hooks/customer/useAddresses';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { Address } from '@/platform/services/model/common';

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuoteRequestDialog({ open, onOpenChange }: QuoteRequestDialogProps) {
  const t = useTranslations('cart.quote');
  const tCheckout = useTranslations('checkout.shipping');
  const { toast } = useToast();

  const { addresses } = useAddresses();
  const { customer } = useCustomer();
  const { checkoutCart, shippingAddress, billingAddress, shippingMethod, submitShippingAddress, submitBillingAddress } =
    useCheckout();

  const [reference, setReference] = useState('');
  const [comment, setComment] = useState('');

  const handleShippingChange = (address: Address) => {
    submitShippingAddress({ ...address, type: 'SHIPPING' });
  };

  const handleBillingChange = (address: Address) => {
    submitBillingAddress({ ...address, type: 'BILLING' });
  };

  // Create a payload using EmporixCreateQuoteFromCartRequest
  const _createFromCartPayload = () => {
    if (!checkoutCart?.id) {
      throw new Error('Cart ID is required for quote from cart');
    }

    //TODO : For cart payload currently for B2B customers we could only pass the address ids of the legal entity

    return {
      cartId: checkoutCart.id,
      billingAddressId: billingAddress?.id,
      shippingAddressId: shippingAddress?.id,
      shipping: shippingMethod
        ? {
            value: shippingMethod.amount,
            methodId: shippingMethod.methodId,
            zoneId: shippingMethod.zoneId,
            shippingTaxCode: shippingMethod.taxCode,
          }
        : undefined,
    } as const;
  };

  // Create manual quote payload
  const createManualPayload = () => {
    const items = (checkoutCart?.items || [])
      .map((item) => {
        const productId = item.product?.id;
        if (!productId) return null;
        const quantity = item.quantity;
        return {
          quantity: {
            quantity,
          },
          product: { productId },
        };
      })
      .filter((x): x is any => Boolean(x));

    return {
      customerId: customer?.id,
      siteCode: checkoutCart?.site,
      currency: checkoutCart?.currency,
      billingAddressId: billingAddress?.id,
      shippingAddressId: shippingAddress?.id,
      shipping: shippingMethod
        ? {
            value: shippingMethod.amount,
            methodId: shippingMethod.methodId,
            zoneId: shippingMethod.zoneId,
            shippingTaxCode: shippingMethod.taxCode,
          }
        : undefined,
      items,
      reference: reference || undefined,
      userComment: comment || undefined,
    } as const;
  };

  const sendQuote = async () => {
    try {
      const payload = createManualPayload();

      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to create quote');
      }

      // Show success toast notification
      toast({
        title: t('submittedTitle'),
        description: t('submittedDescription'),
        variant: 'success',
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Send quote failed', err);
      // Show error toast notification
      toast({
        title: t('failedTitle'),
        description: err instanceof Error ? err.message : t('failedDescription'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-screen-lg lg:max-w-[1220px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <p className="text-sm text-text-on-disabled">{t('subtitle')}</p>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="grid grid-cols-1 gap-6 flex-1 overflow-y-auto px-1 overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Shipping address selector + form */}
          {addresses && addresses.length > 0 && (
            <AddressSelector
              addressType="SHIPPING"
              selectedAddressId={shippingAddress?.id}
              onSelect={handleShippingChange}
              triggerElement={
                <div className="flex gap-1 text-text-action font-bold mb-2 cursor-pointer">
                  <p>{tCheckout('fromAddressbook')}</p>
                </div>
              }
            />
          )}
          <CheckoutAddress
            address={shippingAddress}
            addressLabel={tCheckout('address')}
            isReadOnly={false}
            onAddressChange={handleShippingChange}
          />

          {addresses && addresses.length > 0 && (
            <AddressSelector
              addressType="BILLING"
              selectedAddressId={billingAddress?.id}
              onSelect={handleBillingChange}
              triggerElement={
                <div className="flex gap-1 text-text-action font-bold mb-2 cursor-pointer">
                  <p>{tCheckout('fromAddressbook')}</p>
                </div>
              }
            />
          )}
          <CheckoutAddress
            address={billingAddress}
            addressLabel={t('billingAddress')}
            isReadOnly={false}
            sameAs={
              shippingAddress
                ? {
                    referenceAddress: shippingAddress,
                    label: t('sameAsShipping'),
                    id: 'billingSameAsShipping',
                  }
                : undefined
            }
            onAddressChange={handleBillingChange}
          />

          <ShippingMethod />

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="quote-reference">
                {t('referenceLabel')}
              </label>
              <Input
                id="quote-reference"
                placeholder={t('referencePlaceholder')}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={24}
              />
              <div className="text-sm text-text-placeholders">{reference.length}/24</div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="quote-comment">
                {t('commentLabel')}
              </label>
              <Textarea
                id="quote-comment"
                placeholder={t('commentPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={500}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={sendQuote}>{t('sendQuote')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
