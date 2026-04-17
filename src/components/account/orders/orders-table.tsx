'use client';

import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Order } from '@/platform/services/model/order/order';
import { OrderStatusBadge } from './order-status-badge';

/**
 * Orders Table component
 * Displays a table of orders with their details
 */
export function OrdersTable({ orders }: { orders: Order[] }) {
  const tOrder = useTranslations('orders');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tOrder('orderNumber')}</TableHead>
          <TableHead>{tOrder('columns.status')}</TableHead>
          <TableHead>{tOrder('orderDate')}</TableHead>
          <TableHead>{tOrder('deliveryDate')}</TableHead>
          <TableHead>{tOrder('deliveryAddress')}</TableHead>
          <TableHead>{tOrder('payment')}</TableHead>
          <TableHead>{tOrder('orderValue')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">
              <UiLink href={`/account/orders/${order.id}`} type="Link">
                #{order.id}
              </UiLink>
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell>{order.createdAt ? format(new Date(order.createdAt), 'dd.MM.yyyy') : '-'}</TableCell>
            <TableCell>
              {order.status === 'DELIVERED' && order.lastStatusChange
                ? format(new Date(order.lastStatusChange), 'dd.MM.yyyy')
                : '-'}
            </TableCell>
            <TableCell>
              {order.shippingAddress ? (
                <span className="text-sm">
                  {order.shippingAddress.street} {order.shippingAddress.streetNumber || ''},
                  {order.shippingAddress.zipCode} {order.shippingAddress.city}
                </span>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell>{order.payments && order.payments.length > 0 ? order.payments[0].method : '-'}</TableCell>
            <TableCell>
              {order.price?.total.gross} {order.currency}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
