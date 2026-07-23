'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrderIds } from '@/lib/client/returns';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { formatDate } from '@/lib/date-utils';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency } from '@/lib/utils';
import type { Order, OrderStatus } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import { CreateReturnDialog } from './create-return-dialog';

/**
 * Sortable Order History columns. Expected Delivery Date is intentionally excluded:
 * `Order.expectedDeliveryDate` is resolved by `EmporixOrderMapper` from whichever
 * shipment entry in the `shipments[]` array has a non-empty `expectDeliveryOn`,
 * falling back to `deliveryWindow.deliveryDate` (see `resolveExpectedDeliveryDate`),
 * so there is no single raw upstream field a server-side sort could target.
 * All other columns map to a single raw field via `ORDER_SORT_FIELD_MAP`
 * (see src/components/account/dashboard/cards/my-orders-card.tsx).
 */
export type OrderSortField =
  | 'orderNumber'
  | 'relatedQuote'
  | 'orderDate'
  | 'status'
  | 'orderValue'
  | 'shippingCost'
  | 'customer'
  | 'deliveryAddress';
export type SortDirection = 'asc' | 'desc';

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

export interface MyOrdersTableProps {
  orders: Order[];
  currentPage: number;
  ordersPerPage: number;
  totalCount?: number;
  sortField: OrderSortField;
  sortDirection: SortDirection;
  loading?: boolean;
  className?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSortChange: (field: OrderSortField, direction: SortDirection) => void;
  hasActiveSearch?: boolean;
}

/**
 * Orders Table component for the dashboard
 * Displays a table of orders with pagination controls
 */
export function MyOrdersTable({
  orders,
  currentPage,
  ordersPerPage,
  totalCount,
  sortField,
  sortDirection,
  loading = false,
  className,
  onPreviousPage,
  onNextPage,
  onSortChange,
  hasActiveSearch = false,
}: Readonly<MyOrdersTableProps>) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnabilityMap, setReturnabilityMap] = useState<Record<string, OrderReturnability>>({});

  const toggleSort = (field: OrderSortField) => {
    const nextDirection: SortDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    onSortChange(field, nextDirection);
  };

  const getSortIcon = (field: OrderSortField) => {
    if (loading && sortField === field) {
      return <Spinner variant="sm" color="primary" className="h-4 w-4" loadingText={t('loading')} />;
    }
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    return <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: OrderSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) {
      return 'none';
    }

    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };
  const visibleOrders = orders;

  const completedOrderIds = useMemo(
    () => visibleOrders.filter((o) => isReturnEnabled(o.status)).map((o) => o.id),
    [visibleOrders],
  );

  const hasServerTotalCount = totalCount !== undefined;
  const hasNextPage = hasServerTotalCount
    ? currentPage < Math.ceil(totalCount / ordersPerPage)
    : visibleOrders.length === ordersPerPage;
  const fallbackTotalPages = hasNextPage ? currentPage + 1 : currentPage;
  const totalPages = hasServerTotalCount
    ? Math.max(1, Math.ceil(totalCount / ordersPerPage))
    : Math.max(currentPage, fallbackTotalPages);

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
      } catch (error) {
        if (!cancelled) {
          setReturnabilityMap({});
        }
        getLogger().warn({ err: error }, 'Failed to fetch returns while resolving order returnability');
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

  const renderTableRows = () => {
    if (!loading && visibleOrders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={10} className="text-center py-4">
            {hasActiveSearch ? t('noMatches') : t('noOrders')}
          </TableCell>
        </TableRow>
      );
    }

    return visibleOrders.map((order, index) => {
      const isCompleted = isReturnEnabled(order.status);
      const returnability = returnabilityMap[order.id];
      const isReturnDisabled = isCompleted && returnability?.hasAnyReturnableItem === false;

      let returnContent: ReactNode;
      if (isCompleted) {
        if (isReturnDisabled) {
          returnContent = (
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
          );
        } else {
          returnContent = (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleReturnClick(order);
              }}
              className="text-base leading-6 font-bold underline text-text-action hover:text-text-action-hover"
            >
              {t('returnLink')}
            </button>
          );
        }
      } else {
        returnContent = (
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
        );
      }

      return (
        <TableRow
          key={order.id}
          className={cn(
            'hover:bg-surface-image-background cursor-pointer text-base',
            index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
          )}
          onClick={() => router.push(`/account/orders/${order.id}`)}
        >
          <TableCell className="px-2 py-4 font-medium">
            <UiLink type="Link" href={`/account/orders/${order.id}`} variant="table" className="font-bold">
              {order.id}
            </UiLink>
          </TableCell>
          <TableCell className="px-2 py-4">{order.createdAt ? formatDate(order.createdAt, locale) : '-'}</TableCell>
          <TableCell className="px-2 py-4">
            <OrderStatusBadge status={order.status} />
          </TableCell>
          <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
            {order.quoteId ? (
              <UiLink type="Link" href={`/account/quotes/${order.quoteId}`} variant="table">
                {order.quoteId}
              </UiLink>
            ) : (
              '-'
            )}
          </TableCell>
          <TableCell className="py-4 font-medium">
            {formatOrderValue(order.price?.total?.net, order.price?.total?.currency || order.currency)}
          </TableCell>
          <TableCell className="py-4 font-medium">
            {formatOrderValue(order.shipping?.total.value, order.shipping?.total.currency)}
          </TableCell>
          <TableCell className="px-2 py-4">{getCustomerName(order)}</TableCell>
          <TableCell className="px-2 py-4">
            {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate, locale) : '-'}
          </TableCell>
          <TableCell className="px-2 py-4">{formatAddress(order)}</TableCell>
          <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-center gap-3">
              {returnContent}
              <UiLink type="Link" href={`/account/orders/${order.id}`} variant="table">
                <ArrowRight className="h-6 w-6" />
              </UiLink>
            </div>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <div className={className}>
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
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
              <TableHead className="!h-14 w-[160px] font-bold" aria-sort={getSortAriaSort('relatedQuote')}>
                <button
                  type="button"
                  onClick={() => toggleSort('relatedQuote')}
                  className="flex items-center gap-2 hover:text-text-action"
                >
                  {t('relatedQuote')} #{getSortIcon('relatedQuote')}
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
              <TableHead className="!h-14 w-[200px] font-bold">{t('columns.expectedDeliveryDate')}</TableHead>
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
          <TableBody>{renderTableRows()}</TableBody>
        </Table>
      </div>

      <TablePagination
        className="px-3"
        currentPage={currentPage}
        totalPages={totalPages}
        pageIndicator={t('pageIndicator', {
          current: currentPage,
          total: totalPages,
        })}
        previousLabel={t('previous')}
        nextLabel={t('next')}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />

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
