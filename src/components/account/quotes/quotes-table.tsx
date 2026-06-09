'use client';

import { useTranslations } from 'next-intl';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';
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

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('de', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    } catch (_error) {
      return `${price.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">{t('quoteId')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('quoteReference')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('status')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('quotationDate')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('requestedBy')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('authorization')}</TableHead>
              <TableHead className="whitespace-nowrap text-right">{t('totalAmount')}</TableHead>
              <TableHead className="whitespace-nowrap text-right">{t('numberOfProducts')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Spinner color="primary" variant="md" />
                  </div>
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  {t('noQuotes')}
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote, index) => (
                <TableRow
                  key={quote.id}
                  className={cn(
                    'hover:surface-image-background text-base',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                >
                  <TableCell className="font-medium px-2 py-4">
                    <UiLink
                      type="Link"
                      href={`/account/quotes/${quote.id}`}
                      variant="text"
                      className="no-underline hover:underline"
                    >
                      {quote.id}
                    </UiLink>
                    {quote.orderId ? (
                      <div className="mt-1 text-sm text-text-placeholders">
                        {t('relatedOrder')}{' '}
                        <UiLink
                          type="Link"
                          href={`/account/orders/${quote.orderId}`}
                          variant="text"
                          className="underline"
                        >
                          #{quote.orderId}
                        </UiLink>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-2 py-4">{quote.reference || '-'}</TableCell>
                  <TableCell className="px-2 py-4">
                    <QuoteStatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell className="px-2 py-4">{formatDate(quote.submittedDate)}</TableCell>
                  <TableCell className="px-2 py-4">{quote.customerName || quote.customerId}</TableCell>
                  <TableCell className="px-2 py-4">{quote.approverName || '-'}</TableCell>
                  <TableCell className="text-right px-2 py-4 font-medium">
                    {formatPrice(quote.totalGross, quote.currency)}
                  </TableCell>
                  <TableCell className="text-right px-2 py-4">
                    {quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0}{' '}
                    {t('products')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
