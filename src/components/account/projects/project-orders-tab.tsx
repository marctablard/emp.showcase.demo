'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import { ProjectTabHeader } from '@/components/account/projects/project-tab-header';
import {
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '@/components/account/shared/account-list';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import type { Order } from '@/platform/services/model/order/order';

interface ProjectOrdersTabProps {
  projectId: string;
}

export function ProjectOrdersTab({ projectId }: ProjectOrdersTabProps) {
  const t = useTranslations('account.projects.orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      setOrders(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = normalizedQuery
    ? orders.filter((order) => order.id.toLowerCase().includes(normalizedQuery))
    : orders;

  return (
    <div>
      <ProjectTabHeader
        title={t('title')}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('searchPlaceholder')}
      />
      <Table>
        <TableHeader>
          <TableRow className={accountTableHeadRowClass}>
            <TableHead className={accountTableHeadClass}>{t('orderNumber')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('date')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'text-right')}>{t('total')}</TableHead>
            <TableHead className={accountTableBadgeHeadClass}>{t('status')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-16 text-center')} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <div className="flex items-center justify-center">
                  <Spinner color="primary" variant="md" />
                </div>
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <p className="text-text-error mb-2">{error}</p>
                <Button variant="secondary" size="small" onClick={fetchOrders}>
                  {t('retry')}
                </Button>
              </TableCell>
            </TableRow>
          ) : orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-text-placeholders">
                  <ShoppingBag className="h-10 w-10 text-text-on-disabled" />
                  <p className="font-medium text-text-headings">{t('noOrders')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : filteredOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-text-placeholders">
                  <ShoppingBag className="h-10 w-10 text-text-on-disabled" />
                  <p className="font-medium text-text-headings">{t('noResults')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredOrders.map((order, index) => (
              <TableRow key={order.id} className={accountTableRowClass(index, { clickable: true })}>
                <TableCell className="px-2 py-4 font-medium">
                  <span title={`#${order.id}`}>
                    <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary">
                      #{shortenId(order.id)}
                    </UiLink>
                  </span>
                </TableCell>
                <TableCell className="px-2 py-4">
                  {order.createdAt ? format(new Date(order.createdAt), 'dd.MM.yyyy') : '–'}
                </TableCell>
                <TableCell className="px-2 py-4 text-right font-medium">
                  {order.price?.total ? formatCurrency(order.price.total.gross, order.price.total.currency) : '–'}
                </TableCell>
                <TableCell className={accountTableBadgeCellClass}>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="px-2 py-4 text-center">
                  <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                    <ArrowRight className="h-5 w-5" />
                  </UiLink>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
