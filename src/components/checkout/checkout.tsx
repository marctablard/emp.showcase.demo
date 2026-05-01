'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/cart/useCart';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useCustomer } from '@/hooks/customer/useCustomer';
import { useRouter } from '@/i18n/navigation';
import { createApproval } from '@/lib/client/approval';
import { getLogger } from '@/lib/logger/use-logger-client';
import { H1 } from '../ui/h';
import { Spinner } from '../ui/spinner';
import { ToastType, notify } from '../ui/toast-notification';
import { CheckoutItemlist } from './checkout-itemlist';
import { CheckoutPayment } from './checkout-payment';
import { CheckoutShipping } from './checkout-shipping';
import CheckoutSummary from './checkout-summary';
import { CheckoutValidationProvider } from './checkout-validation-registry';
import { PENDING_APPROVAL_CONFIRMATION_SEGMENT } from './confirmation-constants';
import ContactData from './contact-data';

interface CheckoutProps {
  onComplete?: (orderId: string) => void;
}

/**
 * Single-page checkout component
 * Combines all checkout steps into a single form
 */
const Checkout: React.FC<CheckoutProps> = ({ onComplete }) => {
  const { loading, error, orderResponse, checkoutCart, createCheckoutData, processCheckout } = useCheckout();
  const { customer } = useCustomer();
  const { clearCart } = useCart();
  const router = useRouter();
  const t = useTranslations('checkout');
  const leftContent = useRef<HTMLDivElement>(null);
  const lastNotifiedErrorRef = useRef<Error | null>(null);

  const onSubmit = async (approvalData?: { approverId: string; comment: string }) => {
    if (!checkoutCart) {
      return;
    }

    if (approvalData) {
      const checkoutData = createCheckoutData();
      if (!checkoutData) {
        return;
      }
      // Handle approval data
      await createApproval({
        resourceType: 'CART' as const,
        resourceId: checkoutCart.id,
        action: 'CHECKOUT' as const,
        approver: {
          userId: approvalData.approverId,
        },
        comment: approvalData.comment,
        details: {
          currency: checkoutCart.currency,
          addresses: checkoutData.addresses,
          paymentMethods: [checkoutData.paymentMethod],
          shipping: checkoutData.shipping,
        },
      });
      // Clear the cart after successful approval creation (also delete the cart entity
      // since Emporix does NOT auto-close the cart for approvals)
      clearCart({ deleteCart: true });
      // Navigate to confirmation page
      router.push(`/confirmation/${PENDING_APPROVAL_CONFIRMATION_SEGMENT}`);
    } else {
      // Proceed with checkout
      await processCheckout();
    }
  };

  useEffect(() => {
    if (orderResponse && orderResponse.orderId) {
      if (onComplete) {
        onComplete(orderResponse.orderId);
      } else {
        router.push(`/confirmation/${orderResponse.orderId}`);
        router.refresh();
      }
    }
  }, [orderResponse, onComplete, router]);

  useEffect(() => {
    if (!error) {
      lastNotifiedErrorRef.current = null;
      return;
    }
    if (lastNotifiedErrorRef.current === error) {
      return;
    }
    lastNotifiedErrorRef.current = error;
    notify({ type: ToastType.Error, title: error.message });
  }, [error]);

  if (customer === undefined || loading || orderResponse) {
    getLogger().debug({ customer, loading, orderResponse }, 'Checkout loading state');
    return (
      <div className="mx-4 lg:mx-9">
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner variant="lg" />
        </div>
      </div>
    );
  }
  // If no customer is available, show a message
  if (!checkoutCart) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">
          <H1 variant="h6" className="text-text-heading mb-4">
            {t('title')}
          </H1>
          <p className="text-text-on-disabled">{t('emptyCart')}</p>
        </div>
      </div>
    );
  }

  return (
    <CheckoutValidationProvider>
      <div className="max-w-6xl mx-auto">
        <div className="mx-4 lg:mx-9">
          <div className="flex gap-3 align-end mb-8">
            <H1 variant="h3">{t('title')}</H1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2 lg:col-span-3" ref={leftContent}>
              {!customer && <ContactData />}
              <CheckoutShipping initialEdit={false} />
              <CheckoutPayment initialEdit={false} />
              {/*<CheckoutNotes />*/}
              <CheckoutItemlist />
            </div>
            <div className="col-span-1 mb-6 flex">
              <CheckoutSummary leftContent={leftContent} onSubmit={onSubmit} />
            </div>
          </div>
        </div>
      </div>
    </CheckoutValidationProvider>
  );
};

export default Checkout;
