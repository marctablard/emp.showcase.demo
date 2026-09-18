'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Check, ClockAlert, Package, ReceiptText } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import useCustomer from '@/hooks/customer/useCustomer';
import { useOrder } from '@/hooks/order/useOrder';
import { useL10n } from '@/hooks/useL10n';
import { type OrderStatusKey, type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { orderGoodsSavings } from '@/lib/common/applied-promo-display';
import { PRODUCT_NO_IMAGE_SRC, resolveProductImageSrc } from '@/lib/common/product-image';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/platform/services/model/order/order';
import { AddressDisplay } from '../common/address-display';
import { Card, CardContent, CardHeader } from '../ui/card';
import { H1, H2, H3 } from '../ui/h';
import { createdApprovalDetailsPath, isPendingApprovalConfirmationSegment } from './confirmation-constants';

function OrderConfirmationDiscountRow({ order }: { readonly order: Order }) {
  const tOrder = useTranslations('orders');
  const savings = orderGoodsSavings(order);
  if (!savings) {
    return null;
  }
  return (
    <div className="flex justify-between mb-2" data-testid="order-confirmation-discount">
      <span className="text-text-on-disabled">{tOrder('discount')}</span>
      <span className="font-medium text-text-success">
        {formatCurrency(-Math.abs(savings.amount), savings.currency || order.currency)}
      </span>
    </div>
  );
}

interface OrderConfirmationProps {
  orderId: string;
  initialOrder?: Order | null;
  customerEmail?: string;
  createdApprovalId?: string;
}

/**
 * Order confirmation component
 * Displays confirmation details after a successful checkout
 */
const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderId,
  initialOrder,
  customerEmail,
  createdApprovalId,
}) => {
  const t = useTranslations('orders.Confirmation');
  const tOrder = useTranslations('orders');
  const tOrderStatus = useTranslations('orders.OrderStatus');
  const tPayment = useTranslations('checkout.PaymentModes');
  const tProduct = useTranslations('product');
  const { l10n } = useL10n();
  const { customer } = useCustomer();
  const isApprovalPendingConfirmation = isPendingApprovalConfirmationSegment(orderId);
  const { order, loading, error } = useOrder({
    orderId: isApprovalPendingConfirmation ? undefined : orderId,
    initialOrder,
    autoFetchStatusTransitions: !isApprovalPendingConfirmation && customer !== undefined && customer !== null,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        {isApprovalPendingConfirmation ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-warning rounded-full mb-4">
              <ClockAlert className="h-8 w-8 text-icon-warning" />
            </div>
            <H1 variant="h5" className="text-text-heading mb-2">
              {t('waitingForApproval')}
            </H1>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-success rounded-full mb-4">
              <Check className="h-8 w-8 text-icon-success" />
            </div>
            <H1 variant="h5" className="mb-2">
              {t('orderConfirmed')}
            </H1>
          </>
        )}
        <p className="text-lg text-text-on-disabled">{t('thankYou')}</p>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Spinner color="primary" variant="lg" />
        </div>
      )}

      {error && (
        <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded mb-6">
          <p>{tOrder('errorFetchingOrder')}</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {order && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <H2 variant="h5">{tOrder('orderDetails')}</H2>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-base text-text-on-disabled mb-1">{tOrder('orderNumber')}</p>
                <p className="font-medium">{order.id || orderId}</p>
              </div>

              <div>
                <p className="text-base text-text-on-disabled mb-1">{tOrder('orderDate')}</p>
                <p className="font-medium">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </p>
              </div>

              {customerEmail && (
                <div>
                  <p className="text-base text-text-on-disabled mb-1">{tOrder('email')}</p>
                  <p className="font-medium">{customerEmail}</p>
                </div>
              )}

              <div>
                <p className="text-base text-text-on-disabled mb-1">{tOrder('columns.status')}</p>
                <p className="font-medium capitalize">{tOrderStatus(dk<OrderStatusKey>(order.status))}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <H2 variant="h5">{tOrder('orderItems')}</H2>
              </CardHeader>
              <CardContent>
                {order.items.map((item) => (
                  <div key={item.id} className="py-4 flex flex-wrap sm:flex-nowrap">
                    <div className="mb-4 flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-ss-md rounded-ee-md bg-surface-image-background sm:mb-0 sm:mr-4 sm:h-16 sm:w-16">
                      <Image
                        src={resolveProductImageSrc(item.images?.[0])}
                        alt={
                          resolveProductImageSrc(item.images?.[0]) === PRODUCT_NO_IMAGE_SRC
                            ? tProduct('noImage')
                            : item.name || ''
                        }
                        width={150}
                        height={150}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex-grow">
                      <H3>{item.name || `Product ${item.productId}`}</H3>
                      <p className="text-sm text-text-on-disabled">
                        {tOrder('quantity')}: {item.quantity}
                      </p>
                      <p className="text-sm font-medium">
                        {item.price?.value ? formatCurrency(item.price.value, item.price.currency) : ''}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Order Summary */}
                <div className="mt-6 border-t border-border-primary pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-text-on-disabled">{tOrder('subtotal')}</span>
                    <span className="font-medium">
                      {order.price?.subtotal?.gross ? formatCurrency(order.price.subtotal.gross, order.currency) : ''}
                    </span>
                  </div>

                  {order.shipping && (
                    <div className="flex justify-between mb-2">
                      <span className="text-text-on-disabled">{tOrder('shipping')}</span>
                      <span className="font-medium">
                        {order.shipping.total?.value
                          ? formatCurrency(order.shipping.total.value, order.shipping.total.currency || order.currency)
                          : tOrder('free')}
                      </span>
                    </div>
                  )}

                  <OrderConfirmationDiscountRow order={order} />

                  <div className="flex justify-between pt-2 border-t border-border-primary">
                    <span className="font-medium">{tOrder('total')}</span>
                    <span className="font-bold">
                      {order.price?.total?.gross ? formatCurrency(order.price.total.gross, order.currency) : ''}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipping Address */}
          {order.shippingAddress && (
            <Card className="mb-8">
              <CardHeader>
                <H2 variant="h5">{tOrder('shipping')}</H2>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col pb-4">
                  <p className="font-bold mb-1">{tOrder('shippingAddress')}</p>
                  <div className="flex align-center">
                    {order.shippingAddress && <AddressDisplay address={order.shippingAddress} />}
                  </div>
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col">
                    <p className="font-bold mb-1">{tOrder('shippingMethod')}</p>
                    <div className="flex align-center">
                      <div>
                        <Package className="h-4 w-4 mt-1.5 mr-1.5" />
                      </div>
                      <div>
                        <p>
                          {(() => {
                            const method = order.shipping?.methods?.[0];
                            if (!method) return tOrder('shippingMethodUnknown');
                            const localized = method.localizedName ? l10n(method.localizedName) : '';
                            return localized || method.name || tOrder('shippingMethodUnknown');
                          })()}
                        </p>
                        {/*<p>Arrives on July 12, 2025</p>*/}
                      </div>
                    </div>
                  </div>
                  {/*
              <div className="flex flex-col">
                <p className="font-bold mb-1">{t('freightShipping')}</p>
                <div className="flex align-center">
                  <div>
                    <Truck className="h-4 w-4 mt-1.5 mr-1.5" />
                  </div>
                  <div>
                    <p>{t('freightInfo')}</p>
                  </div>
                </div>
              </div>
              */}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Payment Method */}
          <Card className="mb-8">
            <CardHeader>
              <H2 variant="h5">{tOrder('payment')}</H2>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-bold mb-1">{tOrder('billingAddress')}</p>

                <div className="flex align-center">
                  {order.billingAddress && <AddressDisplay address={order.billingAddress} />}
                </div>
              </div>
              <div className="flex align-center">
                <div>
                  <ReceiptText className="h-4 w-4 mt-1.5 mr-1.5" />
                </div>
                <div>
                  <p className="font-bold">{tPayment(dk<PaymentModeKey>(order.payments?.[0]?.method || 'none'))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-8 text-center space-y-4">
        <p className="text-text-on-disabled">
          {t('emailConfirmation')} {customerEmail || 'your email address'}.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <UiLink type="Link" href="/" data-testid="confirmation-continueShopping">
            {t('continueShopping')}
          </UiLink>

          {customer && (
            <UiLink
              type="Link"
              href={isApprovalPendingConfirmation ? '/account/approvals' : '/account/orders'}
              data-testid={isApprovalPendingConfirmation ? 'confirmation-viewApprovals' : 'confirmation-viewOrders'}
            >
              {isApprovalPendingConfirmation ? t('viewApprovals') : t('viewOrders')}
            </UiLink>
          )}

          {isApprovalPendingConfirmation && createdApprovalId ? (
            <UiLink
              type="Link"
              href={createdApprovalDetailsPath(createdApprovalId)}
              data-testid="confirmation-createdApproval"
            >
              {t('createdApproval')}
            </UiLink>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
