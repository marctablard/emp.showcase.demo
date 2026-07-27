'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { format } from 'date-fns';
import { Ban, CreditCard, ReceiptText, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { H3, H4, H5, H6 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryCard, SummaryField } from '@/components/ui/summary-card';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOrder } from '@/hooks/order/useOrder';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { isOrderAccessDeniedError } from '@/lib/client/orders';
import { fetchReturnsForOrder } from '@/lib/client/returns';
import { ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE } from '@/lib/common/order-customer-decline-not-allowed';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Address } from '@/platform/services/model/common';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';
import { OrderStatusBadge } from './order-status-badge';

const TRACKING_ELIGIBLE_STATUSES: Set<OrderStatus> = new Set([
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.READY_FOR_SHIPPING,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
]);

function shouldShowCancelButton(status: OrderStatus, transitions: string[]): boolean {
  return status === ORDER_STATUS.CREATED && transitions.includes('DECLINED');
}

function shouldShowReturnButton(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function shouldShowTrackShipmentControl(status: OrderStatus): boolean {
  return TRACKING_ELIGIBLE_STATUSES.has(status);
}

function renderAddress(address: Address) {
  return (
    <p>
      {address.contactName}
      <br />
      {address.street} {address.streetNumber || ''}
      <br />
      {address.zipCode} {address.city}
      <br />
      {address.country}
    </p>
  );
}

/** Item unit-price cell: net value primary as bold H5-equivalent text, gross value shown as the small secondary line. */
function ItemPriceCell({
  price,
  tOrder,
}: {
  readonly price?: { value: number; netValue?: number; grossValue?: number; currency: string };
  readonly tOrder: ReturnType<typeof useTranslations<'orders'>>;
}) {
  if (!price) {
    return <>-</>;
  }

  const primaryValue = price.netValue ?? price.value;

  if (price.grossValue === undefined) {
    return (
      <span className="text-3xl font-bold font-headlines text-text-headings">
        {primaryValue} {price.currency}
      </span>
    );
  }

  return (
    <div className="flex flex-col sm:items-end">
      <span className="text-3xl font-bold font-headlines text-text-headings">
        {primaryValue} {price.currency}
      </span>
      <span className="text-sm font-body text-text-placeholders">
        {tOrder('gross')}: {price.grossValue} {price.currency}
      </span>
    </div>
  );
}

/**
 * Order Detail component
 * Displays detailed information for a single order
 */
export function OrderDetail({
  orderId,
  initialOrder,
}: {
  readonly orderId: string;
  readonly initialOrder?: Order | null;
}) {
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnability, setReturnability] = useState<OrderReturnability | null>(null);

  const { order, loading, error, cancelOrder, statusTransitions } = useOrder({ orderId, initialOrder });
  const orderErrorMessage =
    error && isOrderAccessDeniedError(error) ? tOrder('orderAccessDenied') : tOrder('errorFetchingOrder');

  useEffect(() => {
    if (!order || order.status !== ORDER_STATUS.COMPLETED) return;
    let cancelled = false;
    const syncReturnability = async () => {
      try {
        const existingReturns = await fetchReturnsForOrder(order.id);
        if (cancelled) return;
        setReturnability(computeOrderReturnability(order.id, order.items, existingReturns));
      } catch (_error) {
        if (!cancelled) setReturnability(null);
      }
    };
    void syncReturnability();
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-text-error">{orderErrorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shippingMethodName = order.shipping?.methods?.[0]?.name;
  const showTransportCard = Boolean(shippingMethodName || order.expectedDeliveryDate || order.shippingAddress);
  const showPaymentCard = Boolean((order.payments && order.payments.length > 0) || order.billingAddress);
  const showCancelButton = shouldShowCancelButton(order.status, statusTransitions);
  const showReturnButton = shouldShowReturnButton(order.status);
  const showTrackShipmentControl = shouldShowTrackShipmentControl(order.status);
  const hasHeaderActions = showCancelButton || showReturnButton || showTrackShipmentControl;

  const handleCancelOrder = async () => {
    if (!cancelOrder) return;
    try {
      await cancelOrder();
    } catch (err) {
      getLogger().error({ err }, 'Failed to cancel order');
      const message = err instanceof Error ? err.message : '';
      const description =
        message === ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE
          ? tOrder('cancelOrderNotAllowed')
          : message || tOrder('cancelOrderFailedUnknown');
      notify({
        title: tOrder('cancelOrderFailed'),
        description,
        type: ToastType.Error,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: order identity + status on the left, order actions on the right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <H3>
            {tOrder('orderIdHeading')}: {order.id}
          </H3>
          <OrderStatusBadge status={order.status} />
        </div>

        {hasHeaderActions && (
          <div className="flex flex-wrap items-center gap-4">
            {showCancelButton && cancelOrder && (
              <Button variant="secondary" onClick={() => void handleCancelOrder()}>
                <Ban className="h-6 w-6" />
                {tOrder('cancelOrder')}
              </Button>
            )}
            {showReturnButton &&
              (returnability?.hasAnyReturnableItem === false ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="secondary" disabled>
                        <RotateCcw className="h-6 w-6" />
                        {tOrder('returnOrder')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                    {tOrder('noRemainingItems')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="secondary" onClick={() => setReturnDialogOpen(true)}>
                  <RotateCcw className="h-6 w-6" />
                  {tOrder('returnOrder')}
                </Button>
              ))}
            {showTrackShipmentControl && (
              <Button variant="secondary" disabled aria-disabled="true">
                <Truck className="h-6 w-6" />
                {tOrder('trackShipment')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Compact Order Details strip: single surface-primary card, theme shadow, p-6, H4 title */}
      <div className="rounded-md bg-surface-primary shadow-sm p-6">
        <div className="flex flex-col items-start gap-6">
          <H4>{tOrder('orderDetails')}</H4>
          <div className="grid w-full grid-cols-1 gap-2 pb-1 sm:grid-cols-2">
            <SummaryField label={tOrder('orderNumber')} valueClassName="text-sm">
              {order.id}
            </SummaryField>
            <SummaryField label={tOrder('orderDate')} valueClassName="text-sm">
              {order.createdAt ? format(new Date(order.createdAt), 'PPP') : '-'}
            </SummaryField>
          </div>
        </div>
      </div>

      {/* Detail cards: Order Overview (with totals), Shipping, Payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
          <SummaryCard
            heading={tOrder('orderOverview')}
            className="shadow-none rounded-md p-4 h-full gap-4"
            headerClassName="p-0"
            contentClassName="p-0 space-y-4"
            icon={<ReceiptText className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            {order.quoteId && (
              <SummaryField label={tOrder('relatedQuote')}>
                <UiLink href={`/account/quotes/${order.quoteId}`} type="Link" variant="textNoUnderline">
                  {order.quoteId}
                </UiLink>
              </SummaryField>
            )}

            {order.price && (
              <div className="space-y-2 text-base font-body text-text-body">
                <div className="flex justify-between items-start gap-4 border-b border-border-primary pb-4">
                  <span>{tOrder('netValueOfGoods')}</span>
                  <div className="text-right font-normal">
                    <div className="font-normal">
                      {order.price.subtotal.net} {order.price.subtotal.currency}
                    </div>
                    <div className="text-sm text-text-placeholders">
                      {tOrder('gross')}: {order.price.subtotal.gross} {order.price.subtotal.currency}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-4 pt-2">
                  <span>
                    {tOrder('vat')}
                    {order.price.total.net > 0
                      ? ` (${Math.round((order.price.total.tax / order.price.total.net) * 100)}%)`
                      : ''}
                  </span>
                  <span>
                    {order.price.total.tax} {order.price.total.currency}
                  </span>
                </div>

                {order.shipping && (
                  <div className="flex justify-between gap-4 pt-2">
                    <span>{tOrder('shippingFee')}</span>
                    <span>
                      {order.shipping.total.value === 0
                        ? tOrder('free')
                        : `${order.shipping.total.value} ${order.shipping.total.currency}`}
                    </span>
                  </div>
                )}

                {order.discounts && order.discounts.length > 0 && (
                  <div className="flex justify-between gap-4 pt-2">
                    <span>{tOrder('discount')}</span>
                    <span>
                      -{order.discounts[0].value} {order.discounts[0].currency}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-start gap-4 pt-2">
                  <H5>{tOrder('totalValue')}</H5>
                  <div className="text-right">
                    <H5>
                      {order.price.total.net} {order.price.total.currency}
                    </H5>
                    <div className="text-sm font-normal text-text-placeholders">
                      {tOrder('gross')}: {order.price.total.gross} {order.price.total.currency}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SummaryCard>
        </div>

        {showTransportCard && (
          <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
            <SummaryCard
              heading={tOrder('shipping')}
              className="shadow-none rounded-md p-4 h-full gap-4"
              headerClassName="p-0"
              contentClassName="p-0 space-y-4"
              icon={<Truck className="h-8 w-8 text-text-action" />}
              hasHeadline
            >
              {shippingMethodName && <SummaryField label={tOrder('shippingMethod')}>{shippingMethodName}</SummaryField>}
              {order.expectedDeliveryDate && (
                <SummaryField label={tOrder('deliveryDate')}>
                  {format(new Date(order.expectedDeliveryDate), 'PPP')}
                </SummaryField>
              )}
              {order.shippingAddress && (
                <SummaryField label={tOrder('shippingAddress')}>{renderAddress(order.shippingAddress)}</SummaryField>
              )}
            </SummaryCard>
          </div>
        )}

        {showPaymentCard && (
          <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
            <SummaryCard
              heading={tOrder('payment')}
              className="shadow-none rounded-md p-4 h-full gap-4"
              headerClassName="p-0"
              contentClassName="p-0 space-y-4"
              icon={<CreditCard className="h-8 w-8 text-text-action" />}
              hasHeadline
            >
              {order.payments && order.payments.length > 0 && (
                <SummaryField label={tOrder('paymentMethod')}>
                  {tPaymentModes(dk<PaymentModeKey>(order.payments[0].method.toLowerCase()))}
                </SummaryField>
              )}
              {order.billingAddress && (
                <SummaryField label={tOrder('billingAddress')}>{renderAddress(order.billingAddress)}</SummaryField>
              )}
            </SummaryCard>
          </div>
        )}
      </div>

      {/* Product list, following the Returns & Claims product presentation */}
      <Card className="border border-border-primary shadow-sm">
        <CardContent className="p-6">
          <div className="hidden sm:grid grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] gap-6 items-start pb-4 border-b border-border-primary">
            <H6 className="text-sm font-bold text-text-headings">{tOrder('product')}</H6>
            <H6 className="text-sm font-bold text-text-headings text-left">{tOrder('quantity')}</H6>
            <H6 className="text-sm font-bold text-text-headings text-right">{tOrder('price')}</H6>
          </div>

          <div className="divide-y divide-border-primary">
            {order.items.map((item) => {
              const firstImage = item.images?.[0];
              return (
                <div
                  key={item.id}
                  className="py-6 first:pt-4 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] sm:gap-6 sm:items-center"
                >
                  {/* Smallest-mobile: product name/details render above the thumbnail via flex-col-reverse; desktop restores the thumbnail-left row via sm:flex-row. */}
                  <div className="flex flex-col-reverse items-start gap-4 min-w-0 sm:flex-row">
                    <div className="bg-surface-image-background w-[120px] h-[78px] shrink-0 rounded-tl-lg rounded-br-lg overflow-hidden flex items-center justify-center">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={item.name || item.productId}
                          width={120}
                          height={78}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-image-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      {item.vendorName && <span className="text-base font-body text-text-body">{item.vendorName}</span>}
                      <Link
                        href={`/product/${item.productId}`}
                        className="text-2xl font-bold font-headlines text-text-headings hover:underline break-words"
                      >
                        {item.name || item.productId}
                      </Link>
                      {item.sku && (
                        <span className="text-sm text-text-placeholders">
                          {tOrder('itemNumber')}: {item.sku}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* No Quantity label on smallest mobile; left-aligned at desktop widths. */}
                  <div className="text-left">
                    <span className="text-base font-body">{item.quantity}</span>
                  </div>

                  <div className="text-right">
                    <ItemPriceCell price={item.price} tOrder={tOrder} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {order && (
        <CreateReturnDialog
          order={order}
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          returnability={returnability ?? undefined}
        />
      )}
    </div>
  );
}
