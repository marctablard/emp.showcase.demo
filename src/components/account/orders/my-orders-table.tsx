'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/dashboard-badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type OrderStatusLowercaseKey, dk } from '@/i18n/dynamic-key';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrderIds } from '@/lib/client/returns';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { cn, formatCurrency } from '@/lib/utils';
import { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';

function isReturnEnabled(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function formatOrderValue(value: number | undefined, currency: string | undefined): string {
  if (value === undefined || !currency) return '-';
  return formatCurrency(value, currency);
}

function formatAddress(order: Order): string {
  const address = order.shippingAddress;
  if (!address) return '-';

  const parts = [
    [address.street, address.streetNumber].filter(Boolean).join(' ').trim(),
    address.zipCode,
    address.city,
    address.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : '-';
}

function formatPaymentMethod(order: Order, t: ReturnType<typeof useTranslations<'orders'>>): string {
  const method = order.payments?.[0]?.method;
  if (!method) return '-';

  const normalizedMethod = method.toLowerCase();
  return t.has(`paymentTypes.${normalizedMethod}` as any) ? t(`paymentTypes.${normalizedMethod}` as any) : method;
}

export interface MyOrdersTableProps {
  orders: Order[];
  currentPage: number;
  ordersPerPage: number;
  loading?: boolean;
  className?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  getStatusBadge: (status: string) => { variant: 'default' | 'warning' | 'success' };
}

/**
 * Orders Table component for the dashboard
 * Displays a table of orders with pagination controls
 */
export function MyOrdersTable({
  orders,
  currentPage,
  ordersPerPage,
  loading = false,
  className,
  onPreviousPage,
  onNextPage,
  getStatusBadge,
}: MyOrdersTableProps) {
  const t = useTranslations('orders');
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnabilityMap, setReturnabilityMap] = useState<Record<string, OrderReturnability>>({});

  const visibleOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
        .slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage),
    [orders, currentPage, ordersPerPage],
  );

  const completedOrderIds = useMemo(
    () => visibleOrders.filter((o) => isReturnEnabled(o.status)).map((o) => o.id),
    [visibleOrders],
  );

  useEffect(() => {
    let cancelled = false;
    const syncReturnability = async () => {
      if (completedOrderIds.length === 0) {
        if (!cancelled) {
          setReturnabilityMap({});
        }
        return;
      }

      try {
        const returns = await fetchReturnsForOrderIds(completedOrderIds);
        if (cancelled) return;
        const map: Record<string, OrderReturnability> = {};
        for (const order of visibleOrders) {
          if (isReturnEnabled(order.status)) {
            map[order.id] = computeOrderReturnability(order.id, order.items, returns);
          }
        }
        setReturnabilityMap(map);
      } catch (_error) {
        if (!cancelled) setReturnabilityMap({});
      }
    };

    void syncReturnability();

    return () => {
      cancelled = true;
    };
  }, [completedOrderIds, visibleOrders]);

  const handleReturnClick = (order: Order): void => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy');
  };

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className="text-base">
            <TableHead className="!h-14 w-[204px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.orderNumber')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[204px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.status')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.orderValue')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.customer')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.orderDate')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.expectedDeliveryDate')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[240px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.deliveryAddress')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.totalShippingCost')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold">
              <span className="inline-flex items-center gap-1">{t('columns.payment')}</span>
            </TableHead>
            <TableHead className="!h-14 w-[160px] font-bold text-center">{t('columns.action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-4">
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : visibleOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-4">
                {t('noOrders')}
              </TableCell>
            </TableRow>
          ) : (
            visibleOrders.map((order, index) => (
              <TableRow
                key={order.id}
                className={cn(
                  'hover:bg-surface-image-background cursor-pointer text-base',
                  index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                )}
                onClick={() => router.push(`/account/orders/${order.id}`)}
              >
                <TableCell className="px-2 py-4 font-medium">
                  <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                    {order.id}
                  </UiLink>
                </TableCell>
                <TableCell className="px-2 py-4">
                  <Badge
                    variant={getStatusBadge(order.status).variant}
                    className="w-[121px] h-7 !py-1 px-4 !text-[12px] !leading-[12px] font-bold uppercase !tracking-[2px] rounded-[4px] text-text-headings border font-primary"
                  >
                    {t(dk<OrderStatusLowercaseKey>(`status.${order.status.toLowerCase()}`))}
                  </Badge>
                </TableCell>
                <TableCell className="py-4 font-medium">
                  {formatOrderValue(order.price?.total?.gross, order.price?.total?.currency || order.currency)}
                </TableCell>
                <TableCell className="px-2 py-4">
                  {order.customer?.name || order.customer?.firstName || order.customer?.lastName}
                </TableCell>
                <TableCell className="px-2 py-4">{formatDate(order.createdAt)}</TableCell>
                <TableCell className="px-2 py-4">
                  {/* Use lastStatusChange as an approximation for delivery date */}
                  {/*formatDate(order.lastStatusChange)*/}-
                </TableCell>
                <TableCell className="px-2 py-4">{formatAddress(order)}</TableCell>
                <TableCell className="py-4 font-medium">
                  {formatOrderValue(order.shipping?.total.value, order.shipping?.total.currency)}
                </TableCell>
                <TableCell className="px-2 py-4">{formatPaymentMethod(order, t)}</TableCell>
                <TableCell className="px-2 py-4 text-center">
                  <div className="flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {isReturnEnabled(order.status) ? (
                      returnabilityMap[order.id]?.hasAnyReturnableItem === false ? (
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="text-base leading-6 font-bold text-text-disabled cursor-not-allowed">
                              {t('returnLink')}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                            {t('noRemainingItems')}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReturnClick(order)}
                          className="text-base leading-6 font-bold underline text-text-action hover:text-text-action-hover"
                        >
                          {t('returnLink')}
                        </button>
                      )
                    ) : (
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <span className="text-text-disabled text-base leading-6 font-bold cursor-not-allowed">
                            {t('returnLink')}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                          {t('returnDisabledTooltip')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                      <ArrowRight className="h-6 w-6" />
                    </UiLink>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {orders && orders.length > ordersPerPage && (
        <div className="flex items-center justify-end p-3">
          <div className="flex items-center space-x-6">
            {currentPage > 1 && (
              <Button variant="neutral" size="small" onClick={onPreviousPage}>
                <ChevronLeft className="h-4 w-4" />
                {t('previous')}
              </Button>
            )}
            <span className="text-sm">
              {currentPage * ordersPerPage} / {orders?.length || 0}
            </span>
            {currentPage < Math.ceil(orders.length / ordersPerPage) && (
              <Button variant="neutral" size="small" onClick={onNextPage}>
                {t('next')} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <CreateReturnDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          order={selectedOrder}
          returnability={returnabilityMap[selectedOrder.id]}
        />
      )}
    </div>
  );
}
