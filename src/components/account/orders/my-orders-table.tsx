'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, RotateCcw, ShoppingCart } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useRouter } from '@/i18n/navigation';
import { fetchReturnsForOrderIds } from '@/lib/client/returns';
import { canReorder } from '@/lib/common/orders/reorder';
import { type OrderReturnability, computeOrderReturnability } from '@/lib/common/returns/returnability';
import { formatDate } from '@/lib/date-utils';
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
import { ReorderDialog } from './reorder-dialog';

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

const COLUMN_COUNT = 10;

function isReturnEnabled(status: OrderStatus): boolean {
  return status === ORDER_STATUS.COMPLETED;
}

function formatOrderValue(value: number | undefined, currency: string | undefined, locale: string): string {
  if (value === undefined || !currency) return '-';
  return formatCurrency(value, currency, locale);
}

function formatPaymentMethod(order: Order, t: ReturnType<typeof useTranslations<'orders'>>): string {
  const method = order.payments?.[0]?.method;
  if (!method) return '-';

  const normalizedMethod = method.toLowerCase();
  return t.has(`paymentTypes.${normalizedMethod}` as any) ? t(`paymentTypes.${normalizedMethod}` as any) : method;
}

/** True when any of the order's products matches the term by name, SKU or product id. */
function orderHasProductMatch(order: Order, term: string): boolean {
  return (order.items ?? []).some(
    (item) =>
      item.name?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.productId?.toLowerCase().includes(term),
  );
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
  /** Rows whose products match this term (name, SKU, product id) open their product breakdown by default. */
  productHighlightTerm?: string;
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
  productHighlightTerm,
}: Readonly<MyOrdersTableProps>) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const { addItem } = useCart();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnabilityMap, setReturnabilityMap] = useState<Record<string, OrderReturnability>>({});
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null);
  // Per-row expansion overrides on top of the search-match default.
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({});

  const highlightTerm = productHighlightTerm?.trim().toLowerCase() ?? '';
  const isExpandedByDefault = (order: Order) => highlightTerm.length > 0 && orderHasProductMatch(order, highlightTerm);
  const isExpanded = (order: Order) => expandOverrides[order.id] ?? isExpandedByDefault(order);
  const toggleExpanded = (order: Order) =>
    setExpandOverrides((prev) => ({ ...prev, [order.id]: !(prev[order.id] ?? isExpandedByDefault(order)) }));

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

  const renderSortableHead = (field: OrderSortField, label: string, widthClass: string, centered = false) => (
    <TableHead
      className={cn(centered ? accountTableBadgeHeadClass : accountTableHeadClass, widthClass)}
      aria-sort={getSortAriaSort(field)}
    >
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn('flex items-center gap-2 hover:text-text-action', centered && 'mx-auto')}
        data-testid={`orders-sort-${field}`}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  const formatChannel = useCallback((order: Order): string => order.siteCode || '-', []);

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

  const handleReorderClick = useCallback((order: Order): void => {
    if (!canReorder(order)) {
      return;
    }
    setReorderOrder(order);
  }, []);

  const renderDisabledAction = (label: string, tooltip: string, icon: React.ReactNode) => (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span>
          <Button variant="neutral" size="icon" disabled title={label} aria-label={label}>
            {icon}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-[22rem] max-w-[calc(100vw-2rem)] text-wrap">{tooltip}</TooltipContent>
    </Tooltip>
  );

  const renderReturnAction = (order: Order) => {
    const icon = <RotateCcw className="h-4 w-4" />;
    if (!isReturnEnabled(order.status)) {
      return renderDisabledAction(t('returnLink'), t('returnDisabledTooltip'), icon);
    }
    if (returnabilityMap[order.id]?.hasAnyReturnableItem === false) {
      return renderDisabledAction(t('returnLink'), t('noRemainingItems'), icon);
    }
    return (
      <Button
        variant="neutral"
        size="icon"
        title={t('returnLink')}
        aria-label={t('returnLink')}
        onClick={() => handleReturnClick(order)}
        data-testid={`orders-return-${order.id}`}
      >
        {icon}
      </Button>
    );
  };

  const renderTableRows = () => {
    if (!loading && visibleOrders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} className="text-center py-4">
            {hasActiveSearch ? t('noMatches') : t('noOrders')}
          </TableCell>
        </TableRow>
      );
    }

    return visibleOrders.map((order, index) => {
      const expanded = isExpanded(order);

      return (
        <Fragment key={order.id}>
          <TableRow
            className={accountTableRowClass(index, { clickable: true })}
            data-testid={`orders-row-${order.id}`}
            onClick={() => router.push(`/account/orders/${order.id}`)}
          >
            <TableCell className="px-2 py-4 font-medium">
              <span title={`#${order.id}`}>
                <UiLink
                  type="Link"
                  href={`/account/orders/${order.id}`}
                  variant="primary"
                  data-testid={`orders-id-${order.id}`}
                >
                  #{shortenId(order.id)}
                </UiLink>
              </span>
              {order.quoteId ? (
                <div className="mt-1 text-sm text-text-placeholders" onClick={(event) => event.stopPropagation()}>
                  {t('relatedQuote')}{' '}
                  <span title={`#${order.quoteId}`}>
                    <UiLink
                      type="Link"
                      href={`/account/quotes/${order.quoteId}`}
                      variant="text"
                      data-testid={`orders-relatedQuote-${order.quoteId}`}
                    >
                      #{shortenId(order.quoteId)}
                    </UiLink>
                  </span>
                </div>
              ) : null}
            </TableCell>
            <TableCell className="px-2 py-4">
              {order.customer?.name || order.customer?.firstName || order.customer?.lastName}
            </TableCell>
            <TableCell className="px-2 py-4">{order.createdAt ? formatDate(order.createdAt, locale) : '-'}</TableCell>
            <TableCell className="px-2 py-4">{formatChannel(order)}</TableCell>
            <TableCell className="py-4 font-medium">
              {formatOrderValue(order.price?.total?.net, order.price?.total?.currency || order.currency, locale)}
            </TableCell>
            <TableCell className="py-4 font-medium">
              {formatOrderValue(order.shipping?.total.value, order.shipping?.total.currency, locale)}
            </TableCell>
            <TableCell className="px-2 py-4">{formatPaymentMethod(order, t)}</TableCell>
            <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
              <AccountProductThumbnails
                items={(order.items ?? []).map((item) => ({ imageUrl: item.images?.[0], name: item.name }))}
                onToggle={() => toggleExpanded(order)}
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
                    onClick={() => handleReorderClick(order)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                ) : (
                  renderDisabledAction(
                    t('reorderLink'),
                    t('reorderDisabledTooltip'),
                    <ShoppingCart className="h-4 w-4" />,
                  )
                )}
                {renderReturnAction(order)}
                <Button
                  variant="neutral"
                  size="icon"
                  title={t('columns.view')}
                  aria-label={t('columns.view')}
                  onClick={() => router.push(`/account/orders/${order.id}`)}
                  data-testid={`orders-view-${order.id}`}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          {expanded ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
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
    });
  };

  return (
    <div className={className}>
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow className={accountTableHeadRowClass}>
              {renderSortableHead('orderNumber', t('columns.orderNumber'), 'w-[204px]')}
              {renderSortableHead('customer', t('columns.customer'), 'w-[200px]')}
              {renderSortableHead('orderDate', t('columns.orderDate'), 'w-[200px]')}
              <TableHead className={cn(accountTableHeadClass, 'w-[180px]')}>{t('columns.channel')}</TableHead>
              {renderSortableHead('orderValue', t('columns.orderValue'), 'w-[200px]')}
              {renderSortableHead('shippingCost', t('columns.totalShippingCost'), 'w-[200px]')}
              <TableHead className={cn(accountTableHeadClass, 'w-[200px]')}>{t('columns.payment')}</TableHead>
              <TableHead className={cn(accountTableHeadClass, 'w-[160px]')}>{t('columns.products')}</TableHead>
              {renderSortableHead('status', t('columns.status'), 'w-[204px]', true)}
              <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>
                {t('columns.action')}
              </TableHead>
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

      {reorderOrder && (
        <ReorderDialog
          open={Boolean(reorderOrder)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setReorderOrder(null);
          }}
          order={reorderOrder}
          addItem={addItem}
        />
      )}
    </div>
  );
}
