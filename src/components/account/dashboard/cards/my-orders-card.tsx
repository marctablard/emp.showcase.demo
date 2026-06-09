'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable } from '@/components/account/orders/my-orders-table';
import { CardTitle } from '@/components/ui/card';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useOrders } from '@/hooks/order/useOrders';
import { cn } from '@/lib/utils';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

const SEARCH_DEBOUNCE_MS = 500;

interface MyOrdersCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  forceRefreshOnMount?: boolean;
}

export function MyOrdersCard({ className, title, forceRefreshOnMount = false, ...props }: MyOrdersCardProps) {
  const t = useTranslations('orders');

  const [quickSearch, setQuickSearch] = useState('');
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  const apiQuery = normalizedSearch.length > 0 ? `id:~(${normalizedSearch})` : undefined;

  // Fetch orders from the hook
  const { orders, loading, refetchOrders } = useOrders({
    query: apiQuery,
    forceRefresh: apiQuery !== undefined,
  });

  useEffect(() => {
    if (!forceRefreshOnMount) {
      return;
    }
    refetchOrders();
  }, [forceRefreshOnMount, refetchOrders]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 5;

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
      {/* search */}
      <div className="mb-4 w-full max-w-[380px]">
        <div className="relative w-full">
          <Input
            value={quickSearch}
            onChange={(event) => {
              setCurrentPage(1);
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
      {!loading && orders?.length === 0 && normalizedSearch.length > 0 && (
        <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">
          {t('noMatches')}
        </div>
      )}
      <div className="flex flex-col">
        <MyOrdersTable
          orders={orders || []}
          currentPage={currentPage}
          ordersPerPage={ordersPerPage}
          loading={loading}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      </div>
    </DashboardCard>
  );
}
