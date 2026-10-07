'use client';

import { Fragment, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useProducts } from '@/hooks/product/useProducts';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency, l10n } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';
import {
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { AccountProductLines } from '../shared/account-product-lines';
import { AccountProductThumbnails } from '../shared/account-product-thumbnails';
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

const COLUMN_COUNT = 10;

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
  const tOrders = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const productIds = useMemo(
    () => Array.from(new Set(quotes.flatMap((quote) => quote.items?.map((item) => item.product.id) ?? []))),
    [quotes],
  );
  const { products } = useProducts(productIds);
  const productImages = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const product of products) {
      map[product.id] = product.primaryImage?.url ?? product.images?.[0]?.url;
    }
    return map;
  }, [products]);

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

  const renderSortableHead = (field: QuoteSortField, label: string, className: string, centered = false) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => onToggleSort?.(field)}
        disabled={!onToggleSort}
        className={cn('flex items-center gap-2 hover:text-text-action', centered && 'mx-auto')}
        data-testid={`quotes-sort-${field}`}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  const renderRows = () => {
    if (!loading && quotes.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center">
            {hasActiveSearch ? t('noMatches') : t('noQuotes')}
          </TableCell>
        </TableRow>
      );
    }

    return quotes.map((quote, index) => {
      const quoteHref = `/account/quotes/${quote.id}`;
      const expanded = expandedId === quote.id;

      return (
        <Fragment key={quote.id}>
          <TableRow
            className={cn(
              accountTableRowClass(index, { clickable: true }),
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            )}
            tabIndex={0}
            aria-label={t('viewQuoteAriaLabel', { id: quote.id })}
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
              <span title={quote.id}>
                <UiLink
                  type="Link"
                  href={quoteHref}
                  variant="primary"
                  onClick={(event) => event.stopPropagation()}
                  data-testid={`quotes-id-${quote.id}`}
                >
                  {shortenId(quote.id)}
                </UiLink>
              </span>
              {quote.orderId ? (
                <div className="mt-1 text-sm text-text-placeholders" onClick={(event) => event.stopPropagation()}>
                  {t('relatedOrder')}{' '}
                  <span title={`#${quote.orderId}`}>
                    <UiLink
                      type="Link"
                      href={`/account/orders/${quote.orderId}`}
                      variant="text"
                      data-testid={`quotes-relatedOrder-${quote.orderId}`}
                    >
                      #{shortenId(quote.orderId)}
                    </UiLink>
                  </span>
                </div>
              ) : null}
            </TableCell>
            <TableCell className="px-2 py-4">{quote.reference || '-'}</TableCell>
            <TableCell className="px-2 py-4">{formatDate(quote.submittedDate, locale)}</TableCell>
            <TableCell className="px-2 py-4">{quote.customerName || quote.customerId}</TableCell>
            <TableCell className="px-2 py-4">{quote.approverName || '-'}</TableCell>
            <TableCell className="px-2 py-4 text-right font-medium">
              {formatCurrency(quote.totalNet, quote.currency, locale)}
            </TableCell>
            <TableCell className="px-2 py-4 text-right">
              {quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0} {t('products')}
            </TableCell>
            <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
              <AccountProductThumbnails
                items={(quote.items ?? []).map((item) => ({
                  imageUrl: productImages[item.product.id],
                  name: l10n(item.product.name, locale),
                }))}
                onToggle={() => setExpandedId(expanded ? null : quote.id)}
                expanded={expanded}
                toggleLabel={t('products')}
              />
            </TableCell>
            <TableCell className={accountTableBadgeCellClass}>
              <QuoteStatusBadge status={quote.status} />
            </TableCell>
            <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
              <Button
                variant="neutral"
                size="icon"
                title={t('viewQuote')}
                aria-label={t('viewQuoteAriaLabel', { id: quote.id })}
                onClick={() => router.push(quoteHref)}
                data-testid={`quotes-view-${quote.id}`}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
          {expanded ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                <AccountProductLines
                  lines={(quote.items ?? []).map((item) => ({
                    id: item.product.id,
                    imageUrl: productImages[item.product.id],
                    name: l10n(item.product.name, locale),
                    quantity: item.quantity.quantity,
                    unitPrice: item.product.itemPrice?.amount,
                    currency: item.product.itemPrice?.currency,
                  }))}
                />
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      );
    });
  };

  return (
    <div className="w-full">
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow className={accountTableHeadRowClass}>
              {renderSortableHead('quoteId', t('quoteId'), accountTableHeadClass)}
              <TableHead className={accountTableHeadClass}>{t('quoteReference')}</TableHead>
              {renderSortableHead('quotationDate', t('quotationDate'), accountTableHeadClass)}
              {renderSortableHead('customerFirstName', t('requestedBy'), accountTableHeadClass)}
              {renderSortableHead('approverFirstName', t('authorization'), accountTableHeadClass)}
              {renderSortableHead('netValue', t('netValue'), cn(accountTableHeadClass, 'text-right'))}
              <TableHead className={cn(accountTableHeadClass, 'text-right')}>{t('numberOfProducts')}</TableHead>
              <TableHead className={cn(accountTableHeadClass, 'w-[160px]')}>{t('products')}</TableHead>
              {renderSortableHead('status', t('status'), accountTableBadgeHeadClass, true)}
              <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>
                {tOrders('columns.action')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
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
