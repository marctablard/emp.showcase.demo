'use client';

import React, { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { accountTableRowClass, shortenId } from '@/components/account/shared/account-list';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { OrderData, OrderListData } from '../types';
import { extractPrice } from '../utils';
import { widgetOrSkeleton } from './WidgetSkeleton';
import {
  AiOrderStatus,
  AiProductLines,
  AiWidgetFrame,
  aiTableCellClass as cellClass,
  aiTableHeadClass as headClass,
  orderItemToLine,
} from './ai-widget-kit';

interface OrderListRendererProps {
  data: OrderListData;
}

const COLUMN_COUNT = 5;

export const OrderListRenderer: React.FC<OrderListRendererProps> = ({ data }) => {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const orders = data.orders?.filter((order: OrderData) => Boolean(order?.orderId)) ?? [];

  const toggle = (orderId: string) => setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));

  return widgetOrSkeleton(
    data.orders,
    <AiWidgetFrame className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className={cn(headClass, 'pl-4')}>{t('columns.orderNumber')}</TableHead>
            <TableHead className={headClass}>{t('columns.orderDate')}</TableHead>
            <TableHead className={headClass}>{t('columns.products')}</TableHead>
            <TableHead className={cn(headClass, 'text-right')}>{t('columns.orderValue')}</TableHead>
            <TableHead className={cn(headClass, 'pr-4 text-center')}>{t('columns.status')}</TableHead>
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
                  <TableCell className={cn(cellClass, 'pl-4 font-medium')}>
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
                  <TableCell className={cn(cellClass, 'whitespace-nowrap')}>
                    {order.date ? formatDate(order.date, locale) : '-'}
                  </TableCell>
                  <TableCell className={cellClass} onClick={(event) => event.stopPropagation()}>
                    <AccountProductThumbnails
                      items={items.map((item) => ({ imageUrl: item.image, name: item.name }))}
                      onToggle={() => toggle(order.orderId)}
                      expanded={isExpanded}
                      toggleLabel={t('columns.products')}
                      data-testid={`aiOrders-products-${order.orderId}`}
                    />
                  </TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap text-right font-medium')}>
                    {net > 0 ? formatCurrency(net, currency, locale) : '-'}
                  </TableCell>
                  <TableCell className={cn(cellClass, 'pr-4 text-center [&>*]:mx-auto')}>
                    <AiOrderStatus status={order.status} />
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                      <AiProductLines
                        testIdPrefix={`aiOrders-${order.orderId}`}
                        lines={items.map((item) => orderItemToLine(item, currency))}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </AiWidgetFrame>,
  );
};
