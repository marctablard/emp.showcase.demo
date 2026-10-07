'use client';

import React, { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableCellClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '@/components/account/shared/account-list';
import { type AccountProductLine, AccountProductLines } from '@/components/account/shared/account-product-lines';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import { Badge } from '@/components/ui/badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { isOrderStatusValue, normalizeStatusKey } from '@/lib/common/status-tag-variants';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { OrderData, OrderItemData, OrderListData } from '../types';
import { extractPrice } from '../utils';
import { widgetOrSkeleton } from './WidgetSkeleton';

interface OrderListRendererProps {
  data: OrderListData;
}

const COLUMN_COUNT = 5;

function toProductLine(item: OrderItemData, index: number, currency: string): AccountProductLine {
  const quantity = item.quantity || 0;
  const unitNet = item.unitPrice ? extractPrice(item.unitPrice).net : 0;
  const totalNet = item.totalPrice ? extractPrice(item.totalPrice).net : 0;
  const unitPrice = unitNet || (totalNet && quantity ? totalNet / quantity : undefined);

  return {
    id: item.productId || String(index + 1),
    imageUrl: item.image,
    name: item.name,
    quantity,
    unitPrice,
    currency: item.unitPrice?.currency || item.totalPrice?.currency || currency,
  };
}

function OrderStatus({ status }: Readonly<{ status: string }>) {
  const key = normalizeStatusKey(status);
  if (isOrderStatusValue(key)) {
    return <OrderStatusBadge status={key} />;
  }
  return (
    <Badge variant="outline" size="status">
      {status}
    </Badge>
  );
}

export const OrderListRenderer: React.FC<OrderListRendererProps> = ({ data }) => {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const orders = data.orders?.filter((order: OrderData) => Boolean(order?.orderId)) ?? [];

  const toggle = (orderId: string) => setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));

  return widgetOrSkeleton(
    data.orders,
    <AccountListContainer className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className={accountTableHeadRowClass}>
            <TableHead className={accountTableHeadClass}>{t('columns.orderNumber')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('columns.orderDate')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('columns.products')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'text-right')}>{t('columns.orderValue')}</TableHead>
            <TableHead className={accountTableBadgeHeadClass}>{t('columns.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order: OrderData, index: number) => {
            const currency = order.currency || getPublicDefaultCurrency();
            const net = extractPrice(order.total).net;
            const items = order.items ?? [];
            const isExpanded = Boolean(expanded[order.orderId]);

            return (
              <Fragment key={order.orderId}>
                <TableRow
                  className={accountTableRowClass(index, { clickable: true })}
                  data-testid={`aiOrders-row-${order.orderId}`}
                  onClick={() => router.push(`/account/orders/${order.orderId}`)}
                >
                  <TableCell className={cn(accountTableCellClass, 'font-medium')}>
                    <span title={`#${order.orderId}`} onClick={(event) => event.stopPropagation()}>
                      <UiLink
                        type="Link"
                        href={`/account/orders/${order.orderId}`}
                        variant="primary"
                        data-testid={`aiOrders-id-${order.orderId}`}
                      >
                        #{shortenId(order.orderId)}
                      </UiLink>
                    </span>
                  </TableCell>
                  <TableCell className={cn(accountTableCellClass, 'whitespace-nowrap')}>
                    {order.date ? formatDate(order.date, locale) : '-'}
                  </TableCell>
                  <TableCell className={accountTableCellClass} onClick={(event) => event.stopPropagation()}>
                    <AccountProductThumbnails
                      items={items.map((item) => ({ imageUrl: item.image, name: item.name }))}
                      onToggle={() => toggle(order.orderId)}
                      expanded={isExpanded}
                      toggleLabel={t('columns.products')}
                      data-testid={`aiOrders-products-${order.orderId}`}
                    />
                  </TableCell>
                  <TableCell className={cn(accountTableCellClass, 'whitespace-nowrap text-right font-medium')}>
                    {net > 0 ? formatCurrency(net, currency, locale) : '-'}
                  </TableCell>
                  <TableCell className={accountTableBadgeCellClass}>
                    <OrderStatus status={order.status} />
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                      <AccountProductLines lines={items.map((item, i) => toProductLine(item, i, currency))} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </AccountListContainer>,
  );
};
