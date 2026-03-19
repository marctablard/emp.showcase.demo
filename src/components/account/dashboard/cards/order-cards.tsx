'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import { OrdersTable } from '@/components/account/orders/orders-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { H3 } from '@/components/ui/h';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrder } from '@/hooks/order/useOrder';
import { useOrders } from '@/hooks/order/useOrders';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { Order } from '@/platform/services/model/order/order';
import { DashboardCard, DashboardCardProps } from './dashboard-card';
import { StatCard } from './stat-card';

/**
 * Order Summary Card component
 * Shows the total number of orders and orders in progress
 */
function OrderSummaryCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account');
  const { orders, loading } = useOrders();

  if (!orders || loading) {
    return <Spinner />;
  }

  // Calculate order counts
  const totalOrders = orders.length;
  const inProgressOrders = orders.filter((order: Order) =>
    ['CREATED', 'CONFIRMED', 'PROCESSING'].includes(order.status),
  ).length;

  return (
    <StatCard
      title={title || t('ordersAndReturns')}
      value={`${inProgressOrders} / ${totalOrders}`}
      description={t('ordersInProgress', { count: inProgressOrders })}
      icon={<ShoppingBag className="h-4 w-4" />}
      className={className}
      {...props}
    />
  );
}

/**
 * Recent Orders Card component
 * Shows the most recent orders with their status
 */
function RecentOrdersCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account');
  const tOrder = useTranslations('orders');
  const { orders, loading } = useOrders();

  if (!orders || loading) {
    return <Spinner />;
  }

  // Sort orders by creation date (newest first) and take the first 6
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 6);

  return (
    <DashboardCard title={title || t('ordersAndReturns')} className={className} {...props}>
      <div className="items-center justify-between absolute top-4 right-4">
        <Badge variant="secondary">{orders.length}</Badge>
      </div>
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-text-placeholders">{t('loading')}</p>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-text-placeholders">{t('noOrders')}</p>
        ) : (
          recentOrders.map((order) => (
            <div key={order.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tOrder('orderNumber')}{' '}
                    <Link href={`/account/orders/${order.id}`} className="hover:underline">
                      #{order.id}
                    </Link>
                  </p>
                  <p className="text-sm text-text-placeholders mt-1">
                    {order.items.length} {tOrder('quantity')} · {order.price?.total.gross} {order.currency}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm text-text-placeholders whitespace-nowrap">
                    {order.createdAt && formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        <div className="text-center">
          <Link href="/account/orders" className="text-sm text-text-action hover:underline">
            {t('viewAllOrders')}
          </Link>
        </div>
      </div>
    </DashboardCard>
  );
}

/**
 * Orders List component
 * Displays a table of all orders with their details
 */
function OrdersList() {
  const t = useTranslations('account');
  const tOrder = useTranslations('orders');
  const { orders, loading, error } = useOrders();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tOrder('orderDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-text-error">{tOrder('errorFetchingOrder')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-text-placeholders">{t('noOrders')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tOrder('orderDetails')}</CardTitle>
      </CardHeader>
      <CardContent>
        <OrdersTable orders={orders} />
      </CardContent>
    </Card>
  );
}

/**
 * Order Detail component
 * Displays detailed information for a single order
 */
function OrderDetail({ orderId }: { orderId: string }) {
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const { order, loading, error } = useOrder({ orderId });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-text-error">{tOrder('errorFetchingOrder')}</p>
            <Button variant="secondary" className="mt-4" asChild>
              <Link href="/account/orders">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {tOrder('viewOrders')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="secondary" asChild>
        <Link href="/account/orders">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tOrder('viewOrders')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{tOrder('orderDetails')}</CardTitle>
              <CardDescription>
                {tOrder('orderNumber')} #{order.id}
              </CardDescription>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <H3 className="mb-2">{tOrder('orderDate')}</H3>
              <p>{order.createdAt ? format(new Date(order.createdAt), 'PPP') : '-'}</p>

              {order.customerEmail && (
                <>
                  <H3 className="mb-2 mt-4">{tOrder('email')}</H3>
                  <p>{order.customerEmail}</p>
                </>
              )}

              {order.payments && order.payments.length > 0 && (
                <>
                  <H3 className="mb-2 mt-4">{tOrder('paymentMethod')}</H3>
                  <p>{tPaymentModes(dk<PaymentModeKey>(order.payments[0].method.toLowerCase()))}</p>
                </>
              )}
            </div>

            {order.shippingAddress && (
              <div>
                <H3 className="mb-2">{tOrder('shippingAddress')}</H3>
                <p>
                  {order.shippingAddress.contactName}
                  <br />
                  {order.shippingAddress.street} {order.shippingAddress.streetNumber || ''}
                  <br />
                  {order.shippingAddress.zipCode} {order.shippingAddress.city}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <H3 className="mb-4">{tOrder('orderItems')}</H3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tOrder('orderItems')}</TableHead>
                  <TableHead className="text-right">{tOrder('quantity')}</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name || item.productId}</div>
                      {item.sku && <div className="text-sm text-text-placeholders">SKU: {item.sku}</div>}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.price ? (
                        <>
                          {item.price.value} {item.price.currency}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between mb-2">
              <span>{tOrder('subtotal')}</span>
              <span>
                {order.price?.subtotal.gross} {order.currency}
              </span>
            </div>

            {order.shipping && (
              <div className="flex justify-between mb-2">
                <span>{tOrder('shipping')}</span>
                <span>
                  {order.shipping.total.value === 0
                    ? tOrder('free')
                    : `${order.shipping.total.value} ${order.shipping.total.currency}`}
                </span>
              </div>
            )}

            {order.discounts && order.discounts.length > 0 && (
              <div className="flex justify-between mb-2">
                <span>{tOrder('discount')}</span>
                <span>
                  -{order.discounts[0].value} {order.discounts[0].currency}
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold mt-4 pt-4 border-t">
              <span>{tOrder('total')}</span>
              <span>
                {order.price?.total.gross} {order.currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Export all components
export { OrderSummaryCard, RecentOrdersCard, OrdersList, OrderDetail };
