'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  quotesPerPage?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}

export function QuotesTable({
  quotes,
  loading = false,
  currentPage = 1,
  quotesPerPage = 5,
  onPreviousPage,
  onNextPage,
}: QuotesTableProps) {
  const t = useTranslations('account.quotesList');
  const [sortOrder, setSortOrder] = useState<string>('latest');

  // Sort quotes based on the selected order
  const sortedQuotes = [...quotes].sort((a, b) => {
    const dateA = new Date(a.submittedDate);
    const dateB = new Date(b.submittedDate);

    return sortOrder === 'latest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
  });

  const visibleQuotes = sortedQuotes.slice((currentPage - 1) * quotesPerPage, currentPage * quotesPerPage);
  const totalPages = Math.max(1, Math.ceil(sortedQuotes.length / quotesPerPage));

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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[340px]">
              <SelectValue placeholder={t('latest')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">{t('latest')}</SelectItem>
              <SelectItem value="oldest">{t('oldest')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Spinner color="primary" variant="md" />
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {t('noQuotes')}
                </TableCell>
              </TableRow>
            ) : (
              visibleQuotes.map((quote, index) => (
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
                      {quote.reference || '#' + quote.id}
                    </UiLink>
                  </TableCell>
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

      {quotes && quotes.length > quotesPerPage ? (
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
