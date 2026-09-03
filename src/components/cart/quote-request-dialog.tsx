'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AddressSelector } from '@/components/address/address-selector';
import CheckoutAddress from '@/components/checkout/checkout-address';
import ShippingMethod from '@/components/checkout/shipping-method';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useCart } from '@/hooks/cart/useCart';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { useToast } from '@/hooks/ui/useToast';
import { useRouter } from '@/i18n/navigation';
import {
  type PendingQuoteCartTotal,
  evaluateQuoteCartTotalChange,
  snapshotQuoteCartTotal,
} from '@/lib/common/quote-cart-total';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { Address } from '@/platform/services/model/common';

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuoteRequestDialog({ open, onOpenChange }: Readonly<QuoteRequestDialogProps>) {
  const t = useTranslations('cart.quote');
  const tCheckout = useTranslations('checkout.shipping');
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const { clearCart } = useCart();
  const { ready: syncReady } = useGlobalSyncReady();
  const {
    checkoutCart,
    shippingAddress,
    billingAddress,
    shippingMethod,
    submitShippingAddress,
    submitBillingAddress,
    applyShippingDestinationToCart,
    reset,
  } = useCheckout();

  const [reference, setReference] = useState('');
  const [comment, setComment] = useState('');
  const pendingAddressTotalRef = useRef<PendingQuoteCartTotal | null>(null);

  const checkoutCartId = checkoutCart?.id;
  useEffect(() => {
    if (!open || !checkoutCartId || !shippingAddress?.country?.trim() || !shippingAddress?.zipCode?.trim()) {
      return;
    }
    // Leftover emp-checkout ship-to after a prior approval/quote does not
    // re-fire submitShippingAddress. Write destination before quote snapshot.
    applyShippingDestinationToCart(shippingAddress).catch(() => undefined);
  }, [open, checkoutCartId, shippingAddress, applyShippingDestinationToCart]);

  const addressBookOpenRef = useRef(false);
  const handleAddressBookOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      addressBookOpenRef.current = true;
      return;
    }
    // Keep the quote dialog from treating the nested dismiss as its own close.
    queueMicrotask(() => {
      addressBookOpenRef.current = false;
    });
  };

  const handleQuoteOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && addressBookOpenRef.current) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleShippingChange = (address: Address) => {
    const countryOrPostalChanged =
      address.country !== shippingAddress?.country || address.zipCode !== shippingAddress?.zipCode;
    if (countryOrPostalChanged) {
      const previousTotal = snapshotQuoteCartTotal(checkoutCart);
      pendingAddressTotalRef.current = previousTotal ? { total: previousTotal, cart: checkoutCart } : null;
    }
    submitShippingAddress({ ...address, type: 'SHIPPING' });
  };

  useEffect(() => {
    const comparison = evaluateQuoteCartTotalChange(pendingAddressTotalRef.current, checkoutCart, syncReady);
    if (comparison.status === 'wait') {
      return;
    }
    pendingAddressTotalRef.current = null;
    if (!comparison.nextTotal) {
      return;
    }
    notify({
      title: t('totalChanged', {
        total: formatCurrency(comparison.nextTotal.amount, comparison.nextTotal.currency, locale),
      }),
      type: ToastType.Info,
    });
  }, [checkoutCart, locale, syncReady, t]);

  const handleBillingChange = (address: Address) => {
    submitBillingAddress({ ...address, type: 'BILLING' });
  };

  // Build the Emporix QuoteCreateFromCartRequest fields. `reference`/`userComment`
  // are NOT part of this wire shape; they are attached to the /api/quote payload
  // separately (see submitQuote), and /api/quote maps them to Emporix
  // `customerReference`/`customerComment` before forwarding upstream.
  const createFromCartPayload = () => {
    if (!checkoutCart?.id) {
      throw new Error('Cart ID is required for quote from cart');
    }

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

  const submitQuote = async () => {
    if (!checkoutCart?.id || !checkoutCart.items?.length) {
      throw new Error(t('failedDescription'));
    }

    if (!shippingAddress?.country?.trim() || !shippingAddress?.zipCode?.trim()) {
      throw new Error(t('failedDescription'));
    }

    // Quote Service taxes from cart destination, not shippingAddressId. Re-apply
    // even when checkout already shows this address (leftover after a prior quote).
    await applyShippingDestinationToCart(shippingAddress);

    const payload = {
      ...createFromCartPayload(),
      intent: 'REQUEST',
      reference: reference || undefined,
      userComment: comment || undefined,
    };

    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.error || t('failedDescription'));
    }

    const data = await res.json();

    clearCart({ deleteCart: true });
    reset({ keepAddresses: true });

    toast({
      title: t('submittedTitle'),
      description: t('submittedDescription'),
      variant: 'success',
    });

    onOpenChange(false);

    router.push(`/account/quotes/${data.quoteId}`);
  };

  const sendQuote = async (): Promise<boolean> => {
    try {
      await submitQuote();
      return true;
    } catch (err) {
      getLogger().error({ err }, 'Send quote failed');
      toast({
        title: t('failedTitle'),
        description: err instanceof Error ? err.message : t('failedDescription'),
        variant: 'destructive',
      });
      return false;
    }
  };

  const handlePrimaryAction = async () => {
    if (!checkoutCart?.id || !checkoutCart.items?.length) {
      toast({
        title: t('failedTitle'),
        description: t('failedDescription'),
        variant: 'destructive',
      });
      return;
    }

    await sendQuote();
  };

  return (
    <Dialog open={open} onOpenChange={handleQuoteOpenChange}>
      <DialogContent
        closeOnOutsideClick={false}
        className="w-[calc(100%-2rem)] sm:max-w-screen-lg lg:max-w-[1220px] flex min-h-0 flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-text-on-disabled">{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0 overflow-y-auto px-1 overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Shipping address selector + form */}
          <AddressSelector
            addressBook="auto"
            addressType="SHIPPING"
            selectedAddressId={shippingAddress?.id}
            onSelect={handleShippingChange}
            onOpenChange={handleAddressBookOpenChange}
            triggerElement={
              <div className="flex gap-1 text-text-action font-bold mb-2 cursor-pointer">
                <p>{tCheckout('fromAddressbook')}</p>
              </div>
            }
          />
          <CheckoutAddress
            address={shippingAddress}
            addressLabel={tCheckout('address')}
            isReadOnly={false}
            onAddressChange={handleShippingChange}
            testIdPrefix="quoteShipping"
          />

          <AddressSelector
            addressBook="auto"
            addressType="BILLING"
            selectedAddressId={billingAddress?.id}
            onSelect={handleBillingChange}
            onOpenChange={handleAddressBookOpenChange}
            triggerElement={
              <div className="flex gap-1 text-text-action font-bold mb-2 cursor-pointer">
                <p>{tCheckout('fromAddressbook')}</p>
              </div>
            }
          />
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
            testIdPrefix="quoteBilling"
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
                data-testid="quote-reference"
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
                data-testid="quote-comment"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-4 bg-surface-page">
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="quote-cancelButton">
            {t('cancel')}
          </Button>
          <Button onClick={handlePrimaryAction} data-testid="quote-sendButton">
            {t('sendQuote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
