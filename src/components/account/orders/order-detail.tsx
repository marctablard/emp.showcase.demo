'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Ban, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, H3 } from '@/components/ui/h';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOrder } from '@/hooks/order/useOrder';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrder } from '@/lib/client/returns';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';
import { OrderStatusBadge } from './order-status-badge';
import { TrackingDialog } from './tracking-dialog';

function shouldShowCancelButton(status: OrderStatus): boolean {
  return (
    [
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.READY_FOR_SHIPPING,
      ORDER_STATUS.CREATED,
    ] as OrderStatus[]
  ).includes(status);
}

function shouldShowReturnButton(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

/**
 * Order Detail component
 * Displays detailed information for a single order
 */
export function OrderDetail({ orderId, initialOrder }: { orderId: string; initialOrder?: Order | null }) {
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnability, setReturnability] = useState<OrderReturnability | null>(null);
  const router = useRouter();

  const { order, loading, error, cancelOrder } = useOrder({ orderId, initialOrder });

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
            <p className="text-text-error">{tOrder('errorFetchingOrder')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>
                <H2 variant="h4">{tOrder('orderDetails')}</H2>
              </CardTitle>
              <CardDescription>
                {tOrder('orderNumber')} #{order.id}
              </CardDescription>
            </div>
            <div>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <H3 variant="h5" className="mb-2">
                {tOrder('orderDate')}
              </H3>
              <p>{order.createdAt ? format(new Date(order.createdAt), 'PPP') : '-'}</p>

              {order.customerEmail && (
                <>
                  <H3 variant="h5" className="mb-2 mt-4">
                    {tOrder('email')}
                  </H3>
                  <p>{order.customerEmail}</p>
                </>
              )}

              {order.payments && order.payments.length > 0 && (
                <>
                  <H3 variant="h5" className="mb-2 mt-4">
                    {tOrder('paymentMethod')}
                  </H3>
                  <p>{tPaymentModes(dk<PaymentModeKey>(order.payments[0].method.toLowerCase()))}</p>
                </>
              )}
            </div>

            {order.shippingAddress && (
              <div>
                <H3 variant="h5" className="mb-2">
                  {tOrder('shippingAddress')}
                </H3>
                <p>
                  {order.shippingAddress.contactName}
                  <br />
                  {order.shippingAddress.street} {order.shippingAddress.streetNumber || ''}
                  <br />
                  {order.shippingAddress.zipCode} {order.shippingAddress.city}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <H3 variant="h5" className="mb-4">
              {tOrder('orderItems')}
            </H3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tOrder('product')}</TableHead>
                  <TableHead className="text-right">{tOrder('quantity')}</TableHead>
                  <TableHead className="text-right">{tOrder('price')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow
                    className="cursor-pointer hover:bg-surface-action-hover-2"
                    key={item.id}
                    onClick={() => router.push(`/product/${item.productId}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{item.name || item.productId}</div>
                      {item.sku && <div className="text-sm text-text-placeholders">SKU: {item.sku}</div>}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.price ? (
                        <>
                          {item.price.value} {item.price.currency}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between mb-2">
              <span>{tOrder('subtotal')}</span>
              <span>
                {order.price?.subtotal.gross} {order.currency}
              </span>
            </div>

            {order.shipping && (
              <div className="flex justify-between mb-2">
                <span>{tOrder('shipping')}</span>
                <span>
                  {order.shipping.total.value === 0
                    ? tOrder('free')
                    : `${order.shipping.total.value} ${order.shipping.total.currency}`}
                </span>
              </div>
            )}

            {order.discounts && order.discounts.length > 0 && (
              <div className="flex justify-between mb-2">
                <span>{tOrder('discount')}</span>
                <span>
                  -{order.discounts[0].value} {order.discounts[0].currency}
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold mt-4 pt-4 border-t">
              <span>{tOrder('total')}</span>
              <span>
                {order.price?.total.gross} {order.currency}
              </span>
            </div>
          </div>
        </CardContent>
        {/* Order action buttons at the bottom */}
        {(shouldShowCancelButton(order.status) ||
          shouldShowReturnButton(order.status) ||
          (
            [
              ORDER_STATUS.PROCESSING,
              ORDER_STATUS.READY_FOR_SHIPPING,
              ORDER_STATUS.READY_FOR_PICKUP,
              ORDER_STATUS.SHIPPED,

              ORDER_STATUS.DELIVERED,
            ] as OrderStatus[]
          ).includes(order.status)) && (
          <CardFooter className="flex flex-col items-start pt-6 border-t">
            <H2 variant="h5" className="mb-3">
              {tOrder('orderActions')}
            </H2>
            <div className="flex flex-wrap gap-2">
              {shouldShowCancelButton(order.status) && cancelOrder && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={async () => {
                    try {
                      await cancelOrder();
                    } catch (err) {
                      // Handle error, could show a toast notification
                      getLogger().error({ err }, 'Failed to cancel order');
                    }
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {tOrder('cancelOrder')}
                </Button>
              )}
              {shouldShowReturnButton(order.status) &&
                (returnability?.hasAnyReturnableItem === false ? (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="secondary" size="small" disabled>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {tOrder('returnOrder')}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                      {tOrder('noRemainingItems')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button variant="secondary" size="small" onClick={() => setReturnDialogOpen(true)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {tOrder('returnOrder')}
                  </Button>
                ))}
              {(
                [
                  ORDER_STATUS.PROCESSING,
                  ORDER_STATUS.READY_FOR_SHIPPING,
                  ORDER_STATUS.READY_FOR_PICKUP,
                  ORDER_STATUS.SHIPPED,

                  ORDER_STATUS.DELIVERED,
                  ORDER_STATUS.COMPLETED,
                ] as OrderStatus[]
              ).includes(order.status) && (
                <Button variant="secondary" size="small" onClick={() => setTrackingDialogOpen(true)}>
                  <Truck className="mr-2 h-4 w-4" />
                  {tOrder('trackOrder')}
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Tracking Dialog */}
      <TrackingDialog orderId={orderId} open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen} />

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
