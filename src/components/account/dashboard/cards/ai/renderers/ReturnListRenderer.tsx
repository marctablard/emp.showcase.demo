'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { accountTableRowClass, shortenId } from '@/components/account/shared/account-list';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ReturnData, ReturnListData } from '../types';
import { formatPrice } from '../utils';
import { AiReturnStatus, returnCurrencyOf, returnItemsOf } from './ReturnDetailsRenderer';
import { widgetOrSkeleton } from './WidgetSkeleton';
import { AiWidgetFrame, aiTableCellClass as cellClass, aiTableHeadClass as headClass } from './ai-widget-kit';

interface ReturnListRendererProps {
  data: ReturnListData;
}

export const ReturnListRenderer: React.FC<ReturnListRendererProps> = ({ data }) => {
  const t = useTranslations('account.returns');
  const router = useRouter();
  const returns = data.returns?.filter((returnItem: ReturnData) => Boolean(returnItem?.id)) ?? [];

  return widgetOrSkeleton(
    data.returns,
    <div className="space-y-2">
      {data.message ? <p className="px-1 text-sm text-text-body">{data.message}</p> : null}
      <AiWidgetFrame className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className={cn(headClass, 'pl-4')}>{t('returnNumber')}</TableHead>
              <TableHead className={headClass}>{t('orderNumber')}</TableHead>
              <TableHead className={headClass}>{t('reasonLabel')}</TableHead>
              <TableHead className={cn(headClass, 'text-right')}>{t('netReturnValue')}</TableHead>
              <TableHead className={cn(headClass, 'pr-4 text-center')}>{t('statusLabel')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((returnItem, index) => {
              const href = `/account/returns/${returnItem.id}`;
              const items = returnItemsOf(returnItem);
              const value = returnItem.total?.value ?? 0;
              return (
                <TableRow
                  key={returnItem.id}
                  className={accountTableRowClass(index, { clickable: true })}
                  data-testid={`aiReturns-row-${returnItem.id}`}
                  onClick={() => router.push(href)}
                >
                  <TableCell className={cn(cellClass, 'pl-4 font-medium')}>
                    <span onClick={(event) => event.stopPropagation()}>
                      <UiLink type="Link" href={href} variant="primary" data-testid={`aiReturns-id-${returnItem.id}`}>
                        #{shortenId(returnItem.id)}
                      </UiLink>
                    </span>
                    {items.length > 0 ? (
                      <AccountProductThumbnails
                        className="mt-1"
                        items={items.map((item) => ({ imageUrl: item.image, name: item.name }))}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className={cellClass}>
                    {returnItem.orders?.map((order) => `#${shortenId(order.id)}`).join(', ') || '-'}
                  </TableCell>
                  <TableCell className={cellClass}>{returnItem.reason?.code || '-'}</TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap text-right font-medium')}>
                    {value > 0 ? formatPrice(value, returnCurrencyOf(returnItem)) : '-'}
                  </TableCell>
                  <TableCell className={cn(cellClass, 'pr-4 text-center')}>
                    <AiReturnStatus returnItem={returnItem} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AiWidgetFrame>
    </div>,
  );
};
