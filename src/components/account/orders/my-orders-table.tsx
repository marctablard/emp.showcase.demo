'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ArrowRight, RotateCcw, ShoppingCart } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useToast } from '@/hooks/ui/useToast';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrderIds } from '@/lib/client/returns';
import { canReorder, reorderOrderItems } from '@/lib/common/orders/reorder';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency } from '@/lib/utils';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import {
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { AccountProductLines } from '../shared/account-product-lines';
import { AccountProductThumbnails } from '../shared/account-product-thumbnails';
import { CreateReturnDialog } from './create-return-dialog';

function isReturnEnabled(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function formatOrderValue(value: number | undefined, currency: string | undefined): string {
  if (value === undefined || !currency) return '-';
  return formatCurrency(value, currency);
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
}: MyOrdersTableProps) {
  const t = useTranslations('orders');
  const router = useRouter();
  const { addItem } = useCart();
  const { toast } = useToast();
  const logger = getLogger();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnabilityMap, setReturnabilityMap] = useState<Record<string, OrderReturnability>>({});
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const formatChannel = useCallback((order: Order): string => order.siteCode || '-', []);

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

  const handleReorderClick = useCallback(
    async (order: Order): Promise<void> => {
      if (!canReorder(order)) {
        return;
      }

      setReorderingOrderId(order.id);

      try {
        const { total, failed } = await reorderOrderItems(order, addItem);

        if (failed.length > 0) {
          for (const item of failed) {
            logger.error({ productId: item.productId, orderId: order.id }, 'Failed to reorder item');
          }
        }

        if (failed.length === 0) {
          toast({ title: t('reorderAddedToCart'), variant: 'success' });
        } else if (failed.length < total) {
          toast({
            title: t('reorderPartialFailure', { failed: failed.length }),
            variant: 'destructive',
            persistent: true,
          });
        } else {
          toast({ title: t('reorderFailed'), variant: 'destructive', persistent: true });
        }
      } finally {
        setReorderingOrderId(null);
      }
    },
    [addItem, logger, t, toast],
  );

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy');
  };

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className={accountTableHeadRowClass}>
            <TableHead className={cn(accountTableHeadClass, 'w-[204px]')}>{t('columns.orderNumber')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.customer')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.orderDate')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[180px]')}>{t('columns.channel')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.orderValue')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.totalShippingCost')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.payment')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[160px]')}>{t('columns.products')}</TableHead>
            <TableHead className={cn(accountTableBadgeHeadClass, 'w-[204px]')}>{t('columns.status')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>{t('columns.action')}</TableHead>
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
            visibleOrders.map((order, index) => {
              const expanded = expandedOrderId === order.id;

              return (
                <Fragment key={order.id}>
                  <TableRow
                    className={accountTableRowClass(index, { clickable: true })}
                    onClick={() => router.push(`/account/orders/${order.id}`)}
                  >
                    <TableCell className="px-2 py-4 font-medium">
                      <span title={`#${order.id}`}>
                        <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary">
                          #{shortenId(order.id)}
                        </UiLink>
                      </span>
                      {order.quoteId ? (
                        <div
                          className="mt-1 text-sm text-text-placeholders"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('relatedQuote')}{' '}
                          <span title={`#${order.quoteId}`}>
                            <UiLink type="Link" href={`/account/quotes/${order.quoteId}`} variant="text">
                              #{shortenId(order.quoteId)}
                            </UiLink>
                          </span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      {order.customer?.name || order.customer?.firstName || order.customer?.lastName}
                    </TableCell>
                    <TableCell className="px-2 py-4">{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="px-2 py-4">{formatChannel(order)}</TableCell>
                    <TableCell className="py-4 font-medium">
                      {formatOrderValue(order.price?.total?.gross, order.price?.total?.currency || order.currency)}
                    </TableCell>
                    <TableCell className="py-4 font-medium">
                      {formatOrderValue(order.shipping?.total.value, order.shipping?.total.currency)}
                    </TableCell>
                    <TableCell className="px-2 py-4">{formatPaymentMethod(order, t)}</TableCell>
                    <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
                      <AccountProductThumbnails
                        items={(order.items ?? []).map((item) => ({ imageUrl: item.images?.[0], name: item.name }))}
                        onToggle={() => setExpandedOrderId(expanded ? null : order.id)}
                        expanded={expanded}
                        toggleLabel={t('columns.products')}
                      />
                    </TableCell>
                    <TableCell className={accountTableBadgeCellClass}>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="px-2 py-4 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {canReorder(order) ? (
                          <Button
                            variant="neutral"
                            size="icon"
                            title={t('reorderLink')}
                            aria-label={t('reorderLink')}
                            disabled={reorderingOrderId === order.id}
                            onClick={() => void handleReorderClick(order)}
                          >
                            {reorderingOrderId === order.id ? (
                              <Spinner variant="sm" />
                            ) : (
                              <ShoppingCart className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="neutral"
                                  size="icon"
                                  disabled
                                  title={t('reorderLink')}
                                  aria-label={t('reorderLink')}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                              {t('reorderDisabledTooltip')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isReturnEnabled(order.status) ? (
                          returnabilityMap[order.id]?.hasAnyReturnableItem === false ? (
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="neutral"
                                    size="icon"
                                    disabled
                                    title={t('returnLink')}
                                    aria-label={t('returnLink')}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                                {t('noRemainingItems')}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="neutral"
                              size="icon"
                              title={t('returnLink')}
                              aria-label={t('returnLink')}
                              onClick={() => handleReturnClick(order)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )
                        ) : (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="neutral"
                                  size="icon"
                                  disabled
                                  title={t('returnLink')}
                                  aria-label={t('returnLink')}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">
                              {t('returnDisabledTooltip')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="neutral"
                          size="icon"
                          title={t('columns.view')}
                          aria-label={t('columns.view')}
                          onClick={() => router.push(`/account/orders/${order.id}`)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="border-t border-border-primary p-0">
                        <AccountProductLines
                          lines={(order.items ?? []).map((item) => ({
                            id: item.productId,
                            imageUrl: item.images?.[0],
                            name: item.name,
                            quantity: item.quantity,
                            unitPrice: item.price?.value,
                            currency: item.price?.currency,
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      {orders && orders.length > ordersPerPage ? (
        <TablePagination
          className="px-3"
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(orders.length / ordersPerPage))}
          pageIndicator={t('pageIndicator', {
            current: currentPage,
            total: Math.max(1, Math.ceil(orders.length / ordersPerPage)),
          })}
          previousLabel={t('previous')}
          nextLabel={t('next')}
          onPreviousPage={onPreviousPage}
          onNextPage={onNextPage}
        />
      ) : null}

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
