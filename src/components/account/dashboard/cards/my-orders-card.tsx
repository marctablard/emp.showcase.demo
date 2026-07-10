'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable } from '@/components/account/orders/my-orders-table';
import { AccountListContainer } from '@/components/account/shared/account-list';
import { CardTitle } from '@/components/ui/card';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { useOrders } from '@/hooks/order/useOrders';
import { cn } from '@/lib/utils';
import type { Order } from '@/platform/services/model/order/order';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

// On the full orders page we fetch a wide window of history so the client-side
// product/SKU search covers more than just the most recent orders. The compact
// dashboard card stays light since it is not the primary search surface.
const ORDERS_PAGE_SIZE_FULL = 200;
const ORDERS_PAGE_SIZE_COMPACT = 50;

interface MyOrdersCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  forceRefreshOnMount?: boolean;
  /** Hide the in-card title + "show all" row (used when a page header is shown above). */
  showHeader?: boolean;
  /** Render as a flat, bordered list container (matching detail pages) instead of a rounded dashboard card. */
  flat?: boolean;
}

/**
 * Returns true when the search term matches the order id, or any of its
 * products by name, SKU or product id. Enables searching order history by the
 * products it contains, not just the order number.
 */
function orderMatchesSearch(order: Order, term: string): boolean {
  if (order.id?.toLowerCase().includes(term)) {
    return true;
  }
  return (order.items ?? []).some(
    (item) =>
      item.name?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.productId?.toLowerCase().includes(term),
  );
}

export function MyOrdersCard({
  className,
  title,
  forceRefreshOnMount = false,
  showHeader = true,
  flat = false,
  ...props
}: MyOrdersCardProps) {
  const t = useTranslations('orders');

  const [quickSearch, setQuickSearch] = useState('');
  const term = quickSearch.trim().toLowerCase();

  // Fetch orders from the hook
  const { orders, loading, refetchOrders } = useOrders({
    pageSize: flat ? ORDERS_PAGE_SIZE_FULL : ORDERS_PAGE_SIZE_COMPACT,
  });

  useEffect(() => {
    if (!forceRefreshOnMount) {
      return;
    }
    refetchOrders();
  }, [forceRefreshOnMount, refetchOrders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!term) return orders;
    return orders.filter((order) => orderMatchesSearch(order, term));
  }, [orders, term]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 5;

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    const maxPage = Math.ceil(filteredOrders.length / ordersPerPage);
    setCurrentPage((prev) => Math.min(prev + 1, maxPage));
  };

  const showNoMatches = !loading && filteredOrders.length === 0 && term.length > 0;

  const searchField = (
    <div className="relative w-full max-w-[380px]">
      <Input
        value={quickSearch}
        onChange={(event) => {
          setCurrentPage(1);
          setQuickSearch(event.target.value);
        }}
        placeholder={t('search.placeholder')}
        className="pr-10"
        endIcon={Search}
        aria-label={t('search.placeholder')}
      />
    </div>
  );

  const table = (
    <MyOrdersTable
      orders={filteredOrders}
      currentPage={currentPage}
      ordersPerPage={ordersPerPage}
      loading={loading}
      onPreviousPage={handlePreviousPage}
      onNextPage={handleNextPage}
      expandAll={term.length > 0}
    />
  );

  if (flat) {
    return (
      <div className={cn('space-y-6', className)}>
        {searchField}
        {showNoMatches && (
          <div className="border border-border-primary p-4 text-sm text-text-on-disabled">{t('noMatches')}</div>
        )}
        <AccountListContainer>{table}</AccountListContainer>
      </div>
    );
  }

  return (
    <DashboardCard variant="default" className={cn('py-4 pb-0', className)} {...props}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <CardTitle>
            <H4>{title || t('myOrders')}</H4>
          </CardTitle>
          <UiLink type="Link" href="/account/orders" variant="primary" size="m" iconAfter={<ArrowRight />}>
            {t('showAllOrders')}
          </UiLink>
        </div>
      )}
      {/* search */}
      <div className="mb-4">{searchField}</div>
      {showNoMatches && (
        <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">
          {t('noMatches')}
        </div>
      )}
      <div className="flex flex-col">{table}</div>
    </DashboardCard>
  );
}
