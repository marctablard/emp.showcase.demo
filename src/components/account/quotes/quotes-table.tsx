'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';
import {
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { QuoteStatusBadge } from './quote-status-badge';

interface QuotesTableProps {
  quotes: Quote[];
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}

export function QuotesTable({
  quotes,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPreviousPage,
  onNextPage,
}: QuotesTableProps) {
  const t = useTranslations('account.quotesList');
  const tOrders = useTranslations('orders');
  const router = useRouter();

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className={accountTableHeadRowClass}>
            <TableHead className={accountTableHeadClass}>{t('quoteId')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('quoteReference')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('quotationDate')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('requestedBy')}</TableHead>
            <TableHead className={accountTableHeadClass}>{t('authorization')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'text-right')}>{t('totalAmount')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'text-right')}>{t('numberOfProducts')}</TableHead>
            <TableHead className={accountTableBadgeHeadClass}>{t('status')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>
              {tOrders('columns.action')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                <div className="flex items-center justify-center">
                  <Spinner color="primary" variant="md" />
                </div>
              </TableCell>
            </TableRow>
          ) : quotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                {t('noQuotes')}
              </TableCell>
            </TableRow>
          ) : (
            quotes.map((quote, index) => (
              <TableRow
                key={quote.id}
                className={accountTableRowClass(index, { clickable: true })}
                onClick={() => router.push(`/account/quotes/${quote.id}`)}
              >
                <TableCell className="px-2 py-4 font-medium">
                  <span title={quote.id}>
                    <UiLink type="Link" href={`/account/quotes/${quote.id}`} variant="primary">
                      {shortenId(quote.id)}
                    </UiLink>
                  </span>
                  {quote.orderId ? (
                    <div className="mt-1 text-sm text-text-placeholders" onClick={(event) => event.stopPropagation()}>
                      {t('relatedOrder')}{' '}
                      <span title={`#${quote.orderId}`}>
                        <UiLink type="Link" href={`/account/orders/${quote.orderId}`} variant="text">
                          #{shortenId(quote.orderId)}
                        </UiLink>
                      </span>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-2 py-4">{quote.reference || '-'}</TableCell>
                <TableCell className="px-2 py-4">{formatDate(quote.submittedDate)}</TableCell>
                <TableCell className="px-2 py-4">{quote.customerName || quote.customerId}</TableCell>
                <TableCell className="px-2 py-4">{quote.approverName || '-'}</TableCell>
                <TableCell className="px-2 py-4 text-right font-medium">
                  {formatCurrency(quote.totalGross, quote.currency)}
                </TableCell>
                <TableCell className="px-2 py-4 text-right">
                  {quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0} {t('products')}
                </TableCell>
                <TableCell className={accountTableBadgeCellClass}>
                  <QuoteStatusBadge status={quote.status} />
                </TableCell>
                <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="neutral"
                    size="icon"
                    title={t('viewQuote')}
                    aria-label={t('viewQuote')}
                    onClick={() => router.push(`/account/quotes/${quote.id}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <TablePagination
          className="px-3"
          currentPage={currentPage}
          totalPages={totalPages}
          pageIndicator={t('pageIndicator', { current: currentPage, total: totalPages })}
          previousLabel={t('previous')}
          nextLabel={t('next')}
          onPreviousPage={onPreviousPage}
          onNextPage={onNextPage}
        />
      ) : null}
    </div>
  );
}
