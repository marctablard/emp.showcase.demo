'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { accountTableRowClass, shortenId } from '@/components/account/shared/account-list';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { QuoteData, QuoteListData } from '../types';
import { formatPrice } from '../utils';
import { mapAiQuoteList } from '../utils/map-ai-quote';
import { WidgetSkeleton } from './WidgetSkeleton';
import {
  AiQuoteStatus,
  AiWidgetFrame,
  aiTableCellClass as cellClass,
  aiTableHeadClass as headClass,
} from './ai-widget-kit';

interface QuoteListRendererProps {
  data: QuoteListData;
}

export const QuoteListRenderer: React.FC<QuoteListRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tList = useTranslations('account.quotesList');
  const locale = useLocale();
  const router = useRouter();

  if (data.quotes == null) {
    return <WidgetSkeleton />;
  }

  const list = mapAiQuoteList(data, locale);

  return (
    <div className="space-y-2">
      {list.message ? <p className="px-1 text-sm text-text-body">{list.message}</p> : null}
      <AiWidgetFrame className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className={cn(headClass, 'pl-4')}>{tList('quoteId')}</TableHead>
              <TableHead className={headClass}>{tList('quotationDate')}</TableHead>
              <TableHead className={headClass}>{tList('products')}</TableHead>
              <TableHead className={cn(headClass, 'text-right')}>{tList('netValue')}</TableHead>
              <TableHead className={cn(headClass, 'pr-4 text-center')}>{tList('status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.quotes.map((quote: QuoteData, index: number) => {
              const href = `/account/quotes/${quote.quoteId}`;
              return (
                <TableRow
                  key={quote.quoteId || index}
                  className={accountTableRowClass(index, { clickable: true })}
                  data-testid={`aiQuotes-row-${quote.quoteId}`}
                  onClick={() => router.push(href)}
                >
                  <TableCell className={cn(cellClass, 'pl-4 font-medium')}>
                    <span onClick={(event) => event.stopPropagation()}>
                      <UiLink type="Link" href={href} variant="primary" data-testid={`aiQuotes-id-${quote.quoteId}`}>
                        {quote.reference || `#${shortenId(quote.quoteId)}`}
                      </UiLink>
                    </span>
                    {quote.validTo ? (
                      <p className="text-xs font-normal text-text-placeholders">
                        {t('validUntil')} {formatDate(quote.validTo, locale)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap')}>
                    {quote.submittedDate ? formatDate(quote.submittedDate, locale) : '-'}
                  </TableCell>
                  <TableCell className={cellClass}>
                    <AccountProductThumbnails
                      items={(quote.previewItems ?? []).map((item) => ({ imageUrl: item.image, name: item.name }))}
                    />
                  </TableCell>
                  <TableCell className={cn(cellClass, 'whitespace-nowrap text-right font-medium')}>
                    {quote.totalNet || quote.totalGross
                      ? formatPrice(quote.totalNet || quote.totalGross || 0, quote.currency)
                      : '-'}
                  </TableCell>
                  <TableCell className={cn(cellClass, 'pr-4 text-center [&>*]:mx-auto')}>
                    <AiQuoteStatus status={quote.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {list.pagination ? (
          <p className="border-t border-border-primary px-4 py-2 text-xs text-text-placeholders">
            {t('page', {
              page: list.pagination.page,
              totalPages: list.pagination.totalPages,
              totalItems: list.pagination.totalItems,
            })}
          </p>
        ) : null}
      </AiWidgetFrame>
    </div>
  );
};
