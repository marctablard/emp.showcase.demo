'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrderIds } from '@/lib/client/returns';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { cn, formatCurrency } from '@/lib/utils';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';

/**
 * Client-side-only sortable fields for the Order History table.
 * Sorting is applied locally over the already-fetched page of orders; it never
 * changes the upstream Emporix query/sort parameters.
 */
type OrderSortField =
  | 'orderNumber'
  | 'relatedQuote'
  | 'orderDate'
  | 'status'
  | 'orderValue'
  | 'shippingCost'
  | 'customer'
  | 'expectedDeliveryDate'
  | 'deliveryAddress';
type SortDirection = 'asc' | 'desc';

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

function getCustomerName(order: Order): string {
  return order.customer?.name || order.customer?.firstName || order.customer?.lastName || '';
}

function getSortValue(order: Order, field: OrderSortField): string | number {
  switch (field) {
    case 'orderNumber':
      return order.id ?? '';
    case 'relatedQuote':
      return order.quoteId ?? '';
    case 'orderDate':
      return order.createdAt ? new Date(order.createdAt).getTime() : 0;
    case 'status':
      return order.status ?? '';
    case 'orderValue':
      return order.price?.total?.net ?? 0;
    case 'shippingCost':
      return order.shipping?.total.value ?? 0;
    case 'customer':
      return getCustomerName(order);
    case 'expectedDeliveryDate':
      // No delivery-date field exists on the Order model yet; the column always renders the
      // same placeholder ('-'), so every row sorts as equal until real data is available.
      return '-';
    case 'deliveryAddress':
      return formatAddress(order);
    default:
      return '';
  }
}

function compareOrders(a: Order, b: Order, field: OrderSortField, direction: SortDirection): number {
  const aValue = getSortValue(a, field);
  const bValue = getSortValue(b, field);
  const comparison =
    typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
  return direction === 'asc' ? comparison : -comparison;
}

export interface MyOrdersTableProps {
  orders: Order[];
  currentPage: number;
  ordersPerPage: number;
  loading?: boolean;
  className?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  /** Invoked whenever the sort field/direction changes, so the parent can reset pagination to page 1. */
  onSortChange?: () => void;
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
  onSortChange,
}: MyOrdersTableProps) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const statusCollator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base' }), [locale]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnabilityMap, setReturnabilityMap] = useState<Record<string, OrderReturnability>>({});
  const [sortField, setSortField] = useState<OrderSortField>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    onSortChange?.();
  };

  const getSortIcon = (field: OrderSortField) => {
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    return <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: OrderSortField): 'none' | 'ascending' | 'descending' =>
    sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        if (sortField === 'status') {
          const aLabel = t(`status.${a.status.toLowerCase()}`);
          const bLabel = t(`status.${b.status.toLowerCase()}`);
          const statusComparison = statusCollator.compare(aLabel, bLabel);
          return sortDirection === 'asc' ? statusComparison : -statusComparison;
        }

        return compareOrders(a, b, sortField, sortDirection);
      }),
    [orders, sortField, sortDirection, statusCollator, t],
  );

  const visibleOrders = useMemo(
    () => sortedOrders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage),
    [sortedOrders, currentPage, ordersPerPage],
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
          setReturnabilityMap((previous) => (Object.keys(previous).length === 0 ? previous : {}));
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
      <Table containerClassName="pr-1">
        <TableHeader>
          <TableRow className="text-base">
            <TableHead className="!h-14 w-[200px] font-bold" aria-sort={getSortAriaSort('orderNumber')}>
              <button
                type="button"
                onClick={() => toggleSort('orderNumber')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.orderNumber')}
                {getSortIcon('orderNumber')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[160px] font-bold" aria-sort={getSortAriaSort('relatedQuote')}>
              <button
                type="button"
                onClick={() => toggleSort('relatedQuote')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('relatedQuote')} #{getSortIcon('relatedQuote')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[160px] font-bold" aria-sort={getSortAriaSort('orderDate')}>
              <button
                type="button"
                onClick={() => toggleSort('orderDate')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.orderDate')}
                {getSortIcon('orderDate')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[160px] font-bold" aria-sort={getSortAriaSort('status')}>
              <button
                type="button"
                onClick={() => toggleSort('status')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.status')}
                {getSortIcon('status')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[180px] font-bold" aria-sort={getSortAriaSort('orderValue')}>
              <button
                type="button"
                onClick={() => toggleSort('orderValue')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.orderValue')}
                {getSortIcon('orderValue')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[180px] font-bold" aria-sort={getSortAriaSort('shippingCost')}>
              <button
                type="button"
                onClick={() => toggleSort('shippingCost')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.totalShippingCost')}
                {getSortIcon('shippingCost')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold" aria-sort={getSortAriaSort('customer')}>
              <button
                type="button"
                onClick={() => toggleSort('customer')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.customer')}
                {getSortIcon('customer')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[200px] font-bold" aria-sort={getSortAriaSort('expectedDeliveryDate')}>
              <button
                type="button"
                onClick={() => toggleSort('expectedDeliveryDate')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.expectedDeliveryDate')}
                {getSortIcon('expectedDeliveryDate')}
              </button>
            </TableHead>
            <TableHead className="!h-14 w-[240px] font-bold" aria-sort={getSortAriaSort('deliveryAddress')}>
              <button
                type="button"
                onClick={() => toggleSort('deliveryAddress')}
                className="flex items-center gap-2 hover:text-text-action"
              >
                {t('columns.deliveryAddress')}
                {getSortIcon('deliveryAddress')}
              </button>
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
                    #{order.id}
                  </UiLink>
                </TableCell>
                <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
                  {order.quoteId ? (
                    <UiLink type="Link" href={`/account/quotes/${order.quoteId}`} variant="text">
                      #{order.quoteId}
                    </UiLink>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="px-2 py-4">{formatDate(order.createdAt)}</TableCell>
                <TableCell className="px-2 py-4">
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="py-4 font-medium">
                  {formatOrderValue(order.price?.total?.net, order.price?.total?.currency || order.currency)}
                </TableCell>
                <TableCell className="py-4 font-medium">
                  {formatOrderValue(order.shipping?.total.value, order.shipping?.total.currency)}
                </TableCell>
                <TableCell className="px-2 py-4">{getCustomerName(order)}</TableCell>
                <TableCell className="px-2 py-4">
                  {/* Use lastStatusChange as an approximation for delivery date */}
                  {/*formatDate(order.lastStatusChange)*/}-
                </TableCell>
                <TableCell className="px-2 py-4">{formatAddress(order)}</TableCell>
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
