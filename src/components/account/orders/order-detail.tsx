'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Ban, Package, RotateCcw, ShoppingCart, Truck } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useOrder } from '@/hooks/order/useOrder';
import { useSite } from '@/hooks/site/useSite';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrder } from '@/lib/client/returns';
import { ORDER_CUSTOMER_DECLINE_NOT_ALLOWED_MESSAGE } from '@/lib/common/order-customer-decline-not-allowed';
import { canReorder } from '@/lib/common/orders/reorder';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';
import { OrderStatusBadge } from './order-status-badge';
import { OrderSummarySection } from './order-summary-section';
import { ReorderDialog } from './reorder-dialog';
import { TrackingDialog } from './tracking-dialog';

function shouldShowCancelButton(status: OrderStatus, transitions: string[]): boolean {
  return status === ORDER_STATUS.CREATED && transitions.includes('DECLINED');
}

function shouldShowReturnButton(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function shouldShowTrackingButton(status: OrderStatus): boolean {
  return (
    [
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.READY_FOR_SHIPPING,
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.COMPLETED,
    ] as OrderStatus[]
  ).includes(status);
}

function OrderItemRow({ item, onNavigate }: { item: OrderItem; onNavigate: (productId: string) => void }) {
  const imageUrl = item.images?.[0];

  return (
    <TableRow className="cursor-pointer hover:bg-surface-image-background" onClick={() => onNavigate(item.productId)}>
      <TableCell className="w-[88px] py-4 pl-6 pr-3 align-middle sm:pl-8">
        <div className="flex h-[52px] w-20 items-center justify-center border border-border-primary bg-surface-image-background">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.name || item.productId}
              width={80}
              height={52}
              className="h-full w-full object-contain"
            />
          ) : (
            <Package className="h-5 w-5 text-icon-secondary opacity-40" aria-hidden="true" />
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle">
        {item.vendorName ? <p className="text-xs text-text-placeholders">{item.vendorName}</p> : null}
        <p className="text-sm font-bold text-text-headings">{item.name || item.productId}</p>
        {item.sku ? <p className="mt-0.5 text-xs text-text-placeholders">SKU: {item.sku}</p> : null}
      </TableCell>
      <TableCell className="px-4 py-4 text-center align-middle text-sm font-medium tabular-nums">
        {item.quantity}
      </TableCell>
      <TableCell className="py-4 pl-4 pr-6 text-right align-middle text-sm font-bold tabular-nums sm:pr-8">
        {item.price ? formatCurrency(item.price.value, item.price.currency) : '-'}
      </TableCell>
    </TableRow>
  );
}

/**
 * Order Detail component
 * Displays detailed information for a single order
 */
export function OrderDetail({ orderId, initialOrder }: { orderId: string; initialOrder?: Order | null }) {
  const tOrder = useTranslations('orders');
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnability, setReturnability] = useState<OrderReturnability | null>(null);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const router = useRouter();
  const { addItem } = useCart();
  const { availableSites } = useSite();

  const { order, loading, error, cancelOrder, statusTransitions } = useOrder({ orderId, initialOrder });

  const siteName = useMemo(() => {
    if (!order?.siteCode) return null;
    return availableSites?.find((site) => site.code === order.siteCode)?.name ?? order.siteCode;
  }, [availableSites, order]);

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

  const handleReorder = useCallback(() => {
    if (!order || !canReorder(order)) {
      return;
    }
    setReorderDialogOpen(true);
  }, [order]);

  if (loading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="border border-border-primary bg-surface-page p-6 text-center">
        <p className="text-text-error">{tOrder('errorFetchingOrder')}</p>
      </div>
    );
  }

  const showActions =
    canReorder(order) ||
    shouldShowCancelButton(order.status, statusTransitions) ||
    shouldShowReturnButton(order.status) ||
    shouldShowTrackingButton(order.status);

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={tOrder('orderDetails')}
        title={`#${order.id}`}
        aside={
          <AccountDetailStatus label={tOrder('columns.status')}>
            <OrderStatusBadge status={order.status} emphasized />
          </AccountDetailStatus>
        }
      />

      <div className="border-b border-border-primary">
        <OrderSummarySection order={order} siteName={siteName} />
      </div>

      <section className="border-b border-border-primary">
        <AccountSectionBar>{tOrder('orderItems')}</AccountSectionBar>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[88px] py-4 pl-6 pr-3 font-bold sm:pl-8">{tOrder('product')}</TableHead>
              <TableHead className="px-4 py-4 font-bold" />
              <TableHead className="w-28 px-4 py-4 text-center font-bold">{tOrder('quantity')}</TableHead>
              <TableHead className="w-36 py-4 pl-4 pr-6 text-right font-bold sm:pr-8">{tOrder('price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                onNavigate={(productId) => router.push(`/product/${productId}`)}
              />
            ))}
          </TableBody>
        </Table>

        <div className="border-t border-border-primary px-6 py-6 sm:px-8">
          <table className="ml-auto w-full max-w-sm border-collapse text-sm">
            <tbody>
              <tr>
                <td className="py-1 pr-8 text-text-body">{tOrder('subtotal')}</td>
                <td className="py-1 text-right font-medium tabular-nums">
                  {order.price?.subtotal.gross !== undefined && order.currency
                    ? formatCurrency(order.price.subtotal.gross, order.currency)
                    : '-'}
                </td>
              </tr>
              {order.shipping ? (
                <tr>
                  <td className="py-1 pr-8 text-text-body">{tOrder('shipping')}</td>
                  <td className="py-1 text-right font-medium tabular-nums">
                    {order.shipping.total.value === 0
                      ? tOrder('free')
                      : formatCurrency(order.shipping.total.value, order.shipping.total.currency)}
                  </td>
                </tr>
              ) : null}
              {order.discounts?.map((discount) => (
                <tr key={discount.code}>
                  <td className="py-1 pr-8 text-text-body">{tOrder('discount')}</td>
                  <td className="py-1 text-right font-medium tabular-nums text-text-success">
                    -{formatCurrency(discount.value, discount.currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border-primary">
                <td className="pt-3 pr-8 font-bold text-text-headings">{tOrder('total')}</td>
                <td className="pt-3 text-right font-bold tabular-nums text-text-headings">
                  {order.price?.total.gross !== undefined && order.currency
                    ? formatCurrency(order.price.total.gross, order.currency)
                    : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {showActions ? (
        <footer className="px-6 py-6 sm:px-8">
          <AccountSectionLabel className="mb-3">{tOrder('orderActions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            {canReorder(order) ? (
              <Button variant="secondary" size="small" onClick={handleReorder}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {tOrder('reorderLink')}
              </Button>
            ) : (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="secondary" size="small" disabled>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {tOrder('reorderLink')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                  {tOrder('reorderDisabledTooltip')}
                </TooltipContent>
              </Tooltip>
            )}

            {shouldShowCancelButton(order.status, statusTransitions) && cancelOrder ? (
              <Button
                variant="secondary"
                size="small"
                onClick={async () => {
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
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                {tOrder('cancelOrder')}
              </Button>
            ) : null}

            {shouldShowReturnButton(order.status) ? (
              returnability?.hasAnyReturnableItem === false ? (
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
              )
            ) : null}

            {shouldShowTrackingButton(order.status) ? (
              <Button variant="secondary" size="small" onClick={() => setTrackingDialogOpen(true)}>
                <Truck className="mr-2 h-4 w-4" />
                {tOrder('trackOrder')}
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}

      <TrackingDialog orderId={orderId} open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen} />

      <CreateReturnDialog
        order={order}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        returnability={returnability ?? undefined}
      />

      <ReorderDialog order={order} open={reorderDialogOpen} onOpenChange={setReorderDialogOpen} addItem={addItem} />
    </AccountDetailContainer>
  );
}
