'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable, type OrderSortField, type SortDirection } from '@/components/account/orders/my-orders-table';
import { AccountListContainer } from '@/components/account/shared/account-list';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { H1, H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { TableCard } from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useOrders } from '@/hooks/order/useOrders';
import { cn } from '@/lib/utils';
import type { Order } from '@/platform/services/model/order/order';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

const SEARCH_DEBOUNCE_MS = 500;
const ORDERS_PER_PAGE = 5;
/**
 * Raw upstream Emporix Order fields backing each sortable column (see resources/emporix/order.yml).
 * Expected Delivery Date has no entry here: `Order.expectedDeliveryDate` is resolved by
 * `EmporixOrderMapper.resolveExpectedDeliveryDate` from whichever `shipments[]` entry has a
 * non-empty `expectDeliveryOn`, falling back to `deliveryWindow.deliveryDate` — there is no
 * single raw field a server-side sort could target, so that column stays non-sortable.
 */
const ORDER_SORT_FIELD_MAP: Record<OrderSortField, string> = {
  orderNumber: 'id',
  relatedQuote: 'quoteId',
  orderDate: 'created',
  status: 'status',
  orderValue: 'calculatedPrice.finalPrice.netValue',
  shippingCost: 'calculatedPrice.totalShipping.netValue',
  customer: 'customer.name',
  deliveryAddress: 'shippingAddress.street',
};
const INITIAL_SORT_FIELD: OrderSortField = 'orderDate';
const INITIAL_SORT_DIRECTION: SortDirection = 'desc';
const INITIAL_API_SORT = 'created:DESC';

interface MyOrdersCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  /** SSR-fetched orders used to seed the store on the canonical Order History page, avoiding a duplicate client fetch on mount. */
  initialOrders?: Order[];
  /** Renders the canonical Order History full-page layout (H1 heading, no "Show all orders" affordance) instead of the compact dashboard widget. */
  pageMode?: boolean;
  initialTotalCount?: number;
  /** Hide the in-card title + "show all" row (used when a page header is shown above). */
  showHeader?: boolean;
  /** Render as a flat, bordered list container (matching detail pages) instead of a rounded dashboard card. */
  flat?: boolean;
}

export function MyOrdersCard({
  className,
  title,
  initialOrders,
  pageMode = false,
  initialTotalCount,
  showHeader = true,
  flat = false,
  ...props
}: Readonly<MyOrdersCardProps>) {
  const t = useTranslations('orders');

  const [quickSearch, setQuickSearch] = useState('');
  const [sortField, setSortField] = useState<OrderSortField>(INITIAL_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<SortDirection>(INITIAL_SORT_DIRECTION);
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  const apiQuery = normalizedSearch.length > 0 ? `id:~(${normalizedSearch})` : undefined;
  const apiSort = `${ORDER_SORT_FIELD_MAP[sortField]}:${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;

  const { orders, loading, error, totalCount, pageNumber, setPageNumber, refetchOrders } = useOrders({
    initialOrders,
    initialTotalCount,
    pageSize: ORDERS_PER_PAGE,
    pageNumber: 1,
    query: apiQuery,
    sort: apiSort,
    initialRequest: {
      pageNumber: 1,
      pageSize: ORDERS_PER_PAGE,
      sort: INITIAL_API_SORT,
      query: undefined,
    },
  });

  const resetToFirstPage = () => setPageNumber(1);

  const hasServerTotalCount = totalCount !== undefined;
  const hasNextPage = hasServerTotalCount
    ? pageNumber < Math.ceil(totalCount / ORDERS_PER_PAGE)
    : (orders?.length ?? 0) === ORDERS_PER_PAGE;

  // Pagination handlers
  const handlePreviousPage = () => {
    setPageNumber(Math.max(pageNumber - 1, 1));
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setPageNumber(pageNumber + 1);
    }
  };

  const handleSortChange = (field: OrderSortField, direction: SortDirection) => {
    resetToFirstPage();
    setSortField(field);
    setSortDirection(direction);
  };

  const isSearchLoading = loading && normalizedSearch.length > 0;

  const searchInput = (
    <div className={cn('w-full max-w-[380px]', !flat && 'mb-4')}>
      <div className="relative w-full">
        <Input
          value={quickSearch}
          onChange={(event) => {
            setQuickSearch(event.target.value);
          }}
          placeholder={t('search.placeholder')}
          className="pr-10"
          endIcon={isSearchLoading ? undefined : Search}
          aria-label={t('search.placeholder')}
          data-testid="orders-search"
        />
        {isSearchLoading && (
          <Spinner
            variant="sm"
            color="primary"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            loadingText={t('loading')}
          />
        )}
      </div>
    </div>
  );

  const table = error ? (
    <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 space-y-3">
      <p>
        {t('errorLoadingOrders')}: {error.message}
      </p>
      <Button onClick={() => refetchOrders()} data-testid="orders-retryButton">
        {t('tryAgain')}
      </Button>
    </div>
  ) : (
    <MyOrdersTable
      orders={orders || []}
      currentPage={pageNumber}
      ordersPerPage={ORDERS_PER_PAGE}
      totalCount={totalCount}
      sortField={sortField}
      sortDirection={sortDirection}
      loading={loading}
      onPreviousPage={handlePreviousPage}
      onNextPage={handleNextPage}
      onSortChange={handleSortChange}
      hasActiveSearch={normalizedSearch.length > 0}
      productHighlightTerm={normalizedSearch}
    />
  );

  if (flat) {
    return (
      <div className={cn('space-y-6', className)}>
        {searchInput}
        <AccountListContainer>{table}</AccountListContainer>
      </div>
    );
  }

  if (pageMode) {
    return (
      <div className={cn('space-y-6', className)}>
        <H1>{title || t('orderHistory')}</H1>
        <TableCard className="overflow-hidden">
          {searchInput}
          <div className="flex flex-col">{table}</div>
        </TableCard>
      </div>
    );
  }

  return (
    <DashboardCard variant="default" className={cn('py-4 pb-0', className)} {...props}>
      {showHeader ? (
        <div className="flex items-center justify-between mb-4">
          <CardTitle>
            <H4>{title || t('myOrders')}</H4>
          </CardTitle>
          <UiLink
            type="Link"
            href="/account/orders"
            variant="primary"
            size="m"
            iconAfter={<ArrowRight />}
            data-testid="orders-showAll"
          >
            {t('showAllOrders')}
          </UiLink>
        </div>
      ) : null}
      {searchInput}
      <div className="flex flex-col">{table}</div>
    </DashboardCard>
  );
}
