'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';
import { QuoteStatusBadge } from './quote-status-badge';

/**
 * Sortable Quotes columns. Number of Products and Quote Reference are intentionally
 * excluded: Number of Products is a client-side aggregate over `quote.items`, and
 * Quote Reference is a mapper fallback (`customerReference || mixins.additionalInfo.reference`,
 * see `EmporixQuoteMapper`), so sorting upstream by the raw `customerReference` field alone
 * would not reliably reflect the displayed value. Requested By and Authorization sort by
 * `customer.firstName` and `employee.firstName` respectively (the first sub-field of each
 * compound display name), mirroring the Approvals Requestor/Approver pattern.
 */
export type QuoteSortField =
  'quoteId' | 'quotationDate' | 'status' | 'relatedOrder' | 'customerFirstName' | 'approverFirstName' | 'netValue';

/** Raw upstream Emporix Quote fields backing each sortable column (see resources/emporix/quote.yml). */
export const QUOTE_SORT_FIELD_MAP: Record<QuoteSortField, string> = {
  quoteId: 'id',
  quotationDate: 'metadata.createdAt',
  status: 'status.value',
  relatedOrder: 'orderId',
  customerFirstName: 'customer.firstName',
  approverFirstName: 'employee.firstName',
  netValue: 'totalPrice.netValue',
};

interface QuotesTableProps {
  quotes: Quote[];
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  sortField?: QuoteSortField;
  sortDirection?: 'asc' | 'desc';
  onToggleSort?: (field: QuoteSortField) => void;
  hasActiveSearch?: boolean;
}

export function QuotesTable({
  quotes,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPreviousPage,
  onNextPage,
  sortField = 'quotationDate',
  sortDirection = 'desc',
  onToggleSort,
  hasActiveSearch = false,
}: Readonly<QuotesTableProps>) {
  const t = useTranslations('account.quotesList');
  const locale = useLocale();
  const router = useRouter();

  const getSortIcon = (field: QuoteSortField) => {
    if (loading && sortField === field) {
      return <Spinner variant="sm" color="primary" className="h-4 w-4" />;
    }
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: QuoteSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHead = (field: QuoteSortField, label: string, className: string) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => onToggleSort?.(field)}
        disabled={!onToggleSort}
        className="flex items-center gap-2 hover:text-text-action"
        data-testid={`quotes-sort-${field}`}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  return (
    <>
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
        <Table containerClassName="pr-1">
          <TableHeader>
            <TableRow className="text-base">
              {renderSortableHead('quoteId', t('quoteId'), '!h-14 w-[160px] font-bold')}
              {renderSortableHead('quotationDate', t('quotationDate'), '!h-14 w-[160px] font-bold')}
              {renderSortableHead('status', t('status'), '!h-14 w-[140px] font-bold')}
              {renderSortableHead('relatedOrder', t('relatedOrder'), '!h-14 w-[160px] font-bold')}
              <TableHead className="!h-14 w-[180px] font-bold">{t('quoteReference')}</TableHead>
              {renderSortableHead('customerFirstName', t('requestedBy'), '!h-14 w-[180px] font-bold')}
              {renderSortableHead('approverFirstName', t('authorization'), '!h-14 w-[180px] font-bold')}
              {renderSortableHead('netValue', t('netValue'), '!h-14 w-[160px] font-bold')}
              <TableHead className="!h-14 w-[180px] font-bold">{t('numberOfProducts')}</TableHead>
              <TableHead className="!h-14 w-[100px] font-bold text-center">{t('action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              if (!loading && quotes.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      {hasActiveSearch ? t('noMatches') : t('noQuotes')}
                    </TableCell>
                  </TableRow>
                );
              }

              return quotes.map((quote, index) => {
                const quoteHref = `/account/quotes/${quote.id}`;
                const rowAriaLabel = t('viewQuoteAriaLabel', { id: quote.id });

                return (
                  <TableRow
                    key={quote.id}
                    className={cn(
                      'hover:bg-surface-image-background cursor-pointer text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                    )}
                    tabIndex={0}
                    aria-label={rowAriaLabel}
                    data-testid={`quotes-row-${quote.id}`}
                    onClick={() => router.push(quoteHref)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }

                      if (event.key === 'Enter') {
                        event.preventDefault();
                        router.push(quoteHref);
                      }
                    }}
                  >
                    <TableCell className="px-2 py-4 font-medium">
                      <UiLink
                        type="Link"
                        href={quoteHref}
                        variant="table"
                        className="font-bold"
                        onClick={(event) => event.stopPropagation()}
                        data-testid={`quotes-id-${quote.id}`}
                      >
                        {quote.id}
                      </UiLink>
                    </TableCell>
                    <TableCell className="px-2 py-4">{formatDate(quote.submittedDate, locale)}</TableCell>
                    <TableCell className="px-2 py-4">
                      <QuoteStatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
                      {quote.orderId ? (
                        <UiLink
                          type="Link"
                          href={`/account/orders/${quote.orderId}`}
                          variant="table"
                          data-testid={`quotes-relatedOrder-${quote.orderId}`}
                        >
                          {quote.orderId}
                        </UiLink>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-4">{quote.reference || '-'}</TableCell>
                    <TableCell className="px-2 py-4">{quote.customerName || quote.customerId}</TableCell>
                    <TableCell className="px-2 py-4">{quote.approverName || '-'}</TableCell>
                    <TableCell className="px-2 py-4 font-medium">
                      {formatCurrency(quote.totalNet, quote.currency, locale)}
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      {quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0}{' '}
                      {t('products')}
                    </TableCell>
                    <TableCell className="px-2 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <UiLink
                          type="Link"
                          href={quoteHref}
                          variant="table"
                          onClick={(event) => event.stopPropagation()}
                          aria-label={t('viewQuoteAriaLabel', { id: quote.id })}
                          data-testid={`quotes-view-${quote.id}`}
                        >
                          <ArrowRight className="h-6 w-6" />
                        </UiLink>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
      </div>

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
    </>
  );
}
