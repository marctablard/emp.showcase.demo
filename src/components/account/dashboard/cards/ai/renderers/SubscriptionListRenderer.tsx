'use client';

import React, { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { accountTableRowClass, shortenId } from '@/components/account/shared/account-list';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import { SubscriptionStatusBadge } from '@/components/account/subscriptions/subscription-status-badge';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  SUBSCRIPTION_INTERVALS,
  type SubscriptionInterval,
  type SubscriptionStatus,
} from '@/platform/services/subscription/subscription-rules';
import type { SubscriptionListData } from '../types';
import { widgetOrSkeleton } from './WidgetSkeleton';
import {
  AiProductLines,
  AiWidgetFrame,
  aiTableCellClass as cellClass,
  aiTableHeadClass as headClass,
} from './ai-widget-kit';

const COLUMN_COUNT = 5;

const isInterval = (unit: string): unit is SubscriptionInterval =>
  (SUBSCRIPTION_INTERVALS as readonly string[]).includes(unit);

/** Same layout as the order list: id, next order, expandable products, schedule, status. */
export const SubscriptionListRenderer: React.FC<{ data: SubscriptionListData }> = ({ data }) => {
  const t = useTranslations('account.subscriptions');
  const locale = useLocale();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const subscriptions = data.subscriptions ?? [];

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (data.subscriptions && subscriptions.length === 0) {
    return (
      <AiWidgetFrame className="px-4 py-3 text-sm text-text-placeholders">
        {data.scope === 'company' ? t('companyEmpty') : t('empty')}
      </AiWidgetFrame>
    );
  }

  return widgetOrSkeleton(
    data.subscriptions,
    <AiWidgetFrame className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className={cn(headClass, 'pl-4')}>{t('columns.id')}</TableHead>
            <TableHead className={headClass}>{t('columns.nextOrder')}</TableHead>
            <TableHead className={headClass}>{t('columns.products')}</TableHead>
            <TableHead className={cn(headClass, 'text-right')}>{t('columns.cadence')}</TableHead>
            <TableHead className={cn(headClass, 'pr-4 text-center')}>{t('columns.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((subscription, index) => {
            const href = `/account/subscriptions/${subscription.id}`;
            const isExpanded = Boolean(expanded[subscription.id]);
            const cadence = isInterval(subscription.unit)
              ? t('every', { count: subscription.every, unit: t(`unit.${subscription.unit}`) })
              : subscription.renewEvery;

            return (
              <Fragment key={subscription.id}>
                <TableRow
                  className={accountTableRowClass(index, { clickable: true })}
                  data-testid={`aiSubscriptions-row-${subscription.id}`}
                  onClick={() => router.push(href)}
                >
                  <TableCell className={cn(cellClass, 'pl-4 font-medium')}>
                    <span title={`#${subscription.id}`} onClick={(event) => event.stopPropagation()}>
                      <UiLink
                        type="Link"
                        href={href}
                        variant="primary"
                        data-testid={`aiSubscriptions-id-${subscription.id}`}
                      >
                        #{shortenId(subscription.id)}
                      </UiLink>
                    </span>
                    {subscription.owner ? (
                      <p className="text-xs font-normal text-text-placeholders">{subscription.owner}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap')}>
                    {subscription.nextOrderDate ? formatDate(subscription.nextOrderDate, locale) : '-'}
                  </TableCell>
                  <TableCell className={cellClass} onClick={(event) => event.stopPropagation()}>
                    <AccountProductThumbnails
                      items={subscription.products.map((product) => ({
                        imageUrl: product.imageUrl,
                        name: product.name || product.productId,
                      }))}
                      onToggle={() => toggle(subscription.id)}
                      expanded={isExpanded}
                      toggleLabel={t('columns.products')}
                      data-testid={`aiSubscriptions-products-${subscription.id}`}
                    />
                  </TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap text-right font-medium')}>{cadence}</TableCell>
                  <TableCell className={cn(cellClass, 'pr-4 text-center [&>*]:mx-auto')}>
                    <SubscriptionStatusBadge status={subscription.status as SubscriptionStatus} />
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                      <AiProductLines
                        showPrices={false}
                        testIdPrefix={`aiSubscriptions-${subscription.id}`}
                        lines={subscription.products.map((product) => ({
                          id: product.productId,
                          name: product.name || product.productId,
                          imageUrl: product.imageUrl,
                          quantity: product.quantity,
                          href: `/product/${product.productId}`,
                        }))}
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
