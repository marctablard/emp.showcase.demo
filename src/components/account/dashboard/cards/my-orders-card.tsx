'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { MyOrdersTable } from '@/components/account/orders/my-orders-table';
import { CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { useOrders } from '@/hooks/order/useOrders';
import { useValidator } from '@/hooks/validation/useValidator';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

type OrderSearchFormData = {
  searchQuery: string;
};

interface MyOrdersCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  forceRefreshOnMount?: boolean;
}

export function MyOrdersCard({ className, title, forceRefreshOnMount = false, ...props }: MyOrdersCardProps) {
  const t = useTranslations('orders');

  const { form } = useValidator('OrderSearchValidationService', {
    searchQuery: '',
  });

  const handleSearch = (data: OrderSearchFormData) => {
    getLogger().debug({ searchQuery: data.searchQuery }, 'Searching for');
    // Implement search functionality here
  };

  // Fetch orders from the hook
  const { orders, loading, refetchOrders } = useOrders();

  useEffect(() => {
    if (!forceRefreshOnMount) {
      return;
    }
    refetchOrders();
  }, [forceRefreshOnMount, refetchOrders]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 5; // Anzahl der Bestellungen pro Seite

  // Pagination is now handled in the MyOrdersTable component

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSearch)} className="w-full">
            <FormField
              control={form.control}
              name="searchQuery"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={t('search.placeholder')} endIcon={Search} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
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
