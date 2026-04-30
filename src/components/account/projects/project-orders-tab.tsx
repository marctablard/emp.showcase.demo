'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-bold">{t('orderNumber')}</TableHead>
          <TableHead className="font-bold">{t('date')}</TableHead>
          <TableHead className="font-bold">{t('status')}</TableHead>
          <TableHead className="font-bold text-right">{t('total')}</TableHead>
          <TableHead className="w-12" />
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
              <div className="flex flex-col items-center justify-center gap-3 text-text-secondary">
                <ShoppingBag className="h-10 w-10 text-text-on-disabled" />
                <p className="font-medium text-text-headings">{t('noOrders')}</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          orders.map((order, index) => (
            <TableRow
              key={order.id}
              className={cn(
                'hover:bg-surface-image-background cursor-pointer text-base',
                index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
              )}
            >
              <TableCell className="px-2 py-4 font-medium">
                <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                  {order.id}
                </UiLink>
              </TableCell>
              <TableCell className="px-2 py-4">
                {order.createdAt ? format(new Date(order.createdAt), 'dd.MM.yyyy') : '–'}
              </TableCell>
              <TableCell className="px-2 py-4">
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="px-2 py-4 text-right font-medium">
                {order.price?.total ? formatCurrency(order.price.total.gross, order.price.total.currency) : '–'}
              </TableCell>
              <TableCell className="px-2 py-4">
                <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                  <ArrowRight className="h-5 w-5" />
                </UiLink>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
