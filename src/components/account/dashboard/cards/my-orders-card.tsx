'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable } from '@/components/account/orders/my-orders-table';
import { CardTitle } from '@/components/ui/card';
import { H1, H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useOrders } from '@/hooks/order/useOrders';
import { cn } from '@/lib/utils';
import type { Order } from '@/platform/services/model/order/order';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

const SEARCH_DEBOUNCE_MS = 500;

interface MyOrdersCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  /** SSR-fetched orders used to seed the store on the canonical Order History page, avoiding a duplicate client fetch on mount. */
  initialOrders?: Order[];
  /** Renders the canonical Order History full-page layout (H1 heading, no "Show all orders" affordance) instead of the compact dashboard widget. */
  pageMode?: boolean;
}

export function MyOrdersCard({ className, title, initialOrders, pageMode = false, ...props }: MyOrdersCardProps) {
  const t = useTranslations('orders');

  const [quickSearch, setQuickSearch] = useState('');
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  const apiQuery = normalizedSearch.length > 0 ? `id:~(${normalizedSearch})` : undefined;

  // Fetch orders from the hook. `initialOrders` is only forwarded while there is no active
  // search: useOrders() re-seeds the store for the *current* query key whenever it changes, so
  // keeping initialOrders bound to an active search key would mask the real search fetch with
  // the original unfiltered list.
  const { orders, loading } = useOrders({
    initialOrders: apiQuery ? undefined : initialOrders,
    query: apiQuery,
    forceRefresh: apiQuery !== undefined,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 5;

  const resetToFirstPage = () => setCurrentPage(1);

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    if (orders) {
      const maxPage = Math.ceil(orders.length / ordersPerPage);
      setCurrentPage((prev) => Math.min(prev + 1, maxPage));
    }
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

  const noMatches = !loading && orders?.length === 0 && normalizedSearch.length > 0 && (
    <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">{t('noMatches')}</div>
  );

  const table = (
    <MyOrdersTable
      orders={orders || []}
      currentPage={currentPage}
      ordersPerPage={ordersPerPage}
      loading={loading}
      onPreviousPage={handlePreviousPage}
      onNextPage={handleNextPage}
      onSortChange={resetToFirstPage}
    />
  );

  if (pageMode) {
    return (
      <div className={cn('space-y-6', className)}>
        <H1>{title || t('title')}</H1>
        {searchInput}
        {noMatches}
        <div className="flex flex-col">{table}</div>
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
      {noMatches}
      <div className="flex flex-col">{table}</div>
    </DashboardCard>
  );
}
