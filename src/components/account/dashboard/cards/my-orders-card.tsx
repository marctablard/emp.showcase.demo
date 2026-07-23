'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable, type OrderSortField, type SortDirection } from '@/components/account/orders/my-orders-table';
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
}

export function MyOrdersCard({
  className,
  title,
  initialOrders,
  pageMode = false,
  initialTotalCount,
  ...props
}: Readonly<MyOrdersCardProps>) {
  const t = useTranslations('orders');

  const [quickSearch, setQuickSearch] = useState('');
  const [sortField, setSortField] = useState<OrderSortField>(INITIAL_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<SortDirection>(INITIAL_SORT_DIRECTION);
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  const apiQuery =
    normalizedSearch.length > 0
      ? `compoundLogicalQuery:((id:~(${normalizedSearch})) OR (customer.name:~(${normalizedSearch})))`
      : undefined;
  const apiSort = `${ORDER_SORT_FIELD_MAP[sortField]}:${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;

  const { orders, loading, totalCount, pageNumber, setPageNumber } = useOrders({
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
    <div className="mb-4 w-full max-w-[380px]">
      <div className="relative w-full">
        <Input
          value={quickSearch}
          onChange={(event) => {
            resetToFirstPage();
            setQuickSearch(event.target.value);
          }}
          placeholder={t('search.placeholder')}
          className="pr-10"
          endIcon={isSearchLoading ? undefined : Search}
          aria-label={t('search.placeholder')}
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

  const table = (
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
    />
  );

  if (pageMode) {
    return (
      <div className={cn('space-y-6', className)}>
        <H1>{title || t('title')}</H1>
        <TableCard>
          {searchInput}
          <div className="flex flex-col">{table}</div>
        </TableCard>
      </div>
    );
  }

  return (
    <DashboardCard variant="default" className={cn('py-4 pb-0', className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>
          <H4>{title || t('myOrders')}</H4>
        </CardTitle>
        <UiLink type="Link" href="/account/orders" variant="primary" size="m" iconAfter={<ArrowRight />}>
          {t('showAllOrders')}
        </UiLink>
      </div>
      {searchInput}
      <div className="flex flex-col">{table}</div>
    </DashboardCard>
  );
}
