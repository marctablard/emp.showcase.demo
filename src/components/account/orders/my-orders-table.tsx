'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/dashboard-badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Order } from '@/platform/services/model/order/order';

export interface MyOrdersTableProps {
  orders: Order[];
  currentPage: number;
  ordersPerPage: number;
  loading?: boolean;
  className?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  getStatusBadge: (status: string) => { variant: 'default' | 'warning' | 'success' };
}

/**
 * Orders Table component for the dashboard
 * Displays a table of orders with pagination controls
 */
export function MyOrdersTable({
  orders,
  currentPage,
  ordersPerPage,
  loading = false,
  className,
  onPreviousPage,
  onNextPage,
  getStatusBadge,
}: MyOrdersTableProps) {
  const t = useTranslations('orders');
  const router = useRouter();

  // Format date in the current locale
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy');
  };

  // Format address
  const formatAddress = (address: any) => {
    if (!address) return '-';
    return `${address.city}, ${address.country}`;
  };

  // Format payment method
  const formatPayment = (payments: any[] | undefined) => {
    if (!payments || payments.length === 0) return '-';
    // Use the translation for the payment method if available
    return t(`paymentTypes.${payments[0].method.toLowerCase()}`) || payments[0].method;
  };

  // Get visible orders for current page
  const visibleOrders = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className="text-base">
            <TableHead className="w-[120px] font-bold">{t('columns.orderNumber')}</TableHead>
            <TableHead className="w-[100px] font-bold">{t('columns.status')}</TableHead>
            <TableHead className="w-[100px] font-bold">{t('columns.customer')}</TableHead>
            <TableHead className="w-[100px] font-bold">{t('columns.orderDate')}</TableHead>
            <TableHead className="w-[100px] font-bold">{t('columns.deliveryDate')}</TableHead>
            <TableHead className="w-[150px] font-bold">{t('columns.deliveryAddress')}</TableHead>
            <TableHead className="w-[120px] font-bold">{t('columns.payment')}</TableHead>
            <TableHead className="w-[100px] font-bold text-right">{t('columns.orderValue')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : visibleOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
                {t('noOrders')}
              </TableCell>
            </TableRow>
          ) : (
            visibleOrders.map((order, index) => (
              <TableRow
                key={order.id}
                className={cn(
                  'hover:bg-surface-image-background cursor-pointer text-base',
                  index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                )}
                onClick={() => router.push(`/account/orders/${order.id}`)}
              >
                <TableCell className="px-2 py-4 font-medium">
                  <UiLink type="Link" href={`/account/orders/${order.id}`} variant="primary" size="m">
                    #{order.id}
                  </UiLink>
                </TableCell>
                <TableCell className="px-2 py-4">
                  <Badge variant={getStatusBadge(order.status).variant}>
                    {t(`status.${order.status.toLowerCase()}`)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-4">
                  {order.customer?.name || order.customer?.firstName || order.customer?.lastName}
                </TableCell>
                <TableCell className="px-2 py-4">{formatDate(order.lastStatusChange)}</TableCell>
                <TableCell className="px-2 py-4">
                  {/* Use lastStatusChange as an approximation for delivery date */}
                  {/*formatDate(order.lastStatusChange)*/}-
                </TableCell>
                <TableCell className="px-2 py-4">{formatAddress(order.shippingAddress)}</TableCell>
                <TableCell className="px-2 py-4">{formatPayment(order.payments)}</TableCell>
                <TableCell className="text-right py-4 font-medium">
                  {order.price?.total.gross} {order.currency}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {orders && orders.length > ordersPerPage && (
        <div className="flex items-center justify-end p-3">
          <div className="flex items-center space-x-6">
            {currentPage > 1 && (
              <Button variant="neutral" size="small" onClick={onPreviousPage}>
                <ChevronLeft className="h-4 w-4" />
                {t('previous')}
              </Button>
            )}
            <span className="text-sm">
              {currentPage * ordersPerPage} / {orders?.length || 0}
            </span>
            {currentPage < Math.ceil(orders.length / ordersPerPage) && (
              <Button variant="neutral" size="small" onClick={onNextPage}>
                {t('next')} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
