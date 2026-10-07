'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useReturns } from '@/hooks/return/useReturns';
import { useRouter } from '@/i18n/navigation';
import { ReturnApiError } from '@/lib/client/returns';
import { RETURN_ERROR_CODE } from '@/lib/common/returns/return-error-codes';
import { cn } from '@/lib/utils';
import type { Return } from '@/platform/services/model/return';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { AccountPageHeader } from '../shared/account-page-header';
import {
  formatReturnCurrency,
  formatReturnDate,
  getFirstOrderId,
  getNetReturnValue,
  getReturnReasonCode,
} from './helpers';
import { renderReturnReasonLabel } from './reason-labels';
import { ReturnStatusBadge } from './return-status-badge';
import { useReturnErrorMessage } from './use-return-error-message';

type ReturnSortField = 'date' | 'status' | 'returnNumber' | 'netValue' | 'reason' | 'customer';
const RETURNS_PER_PAGE = 5;
const SEARCH_DEBOUNCE_MS = 500;
const ERROR_MESSAGE_ID = 'returns-list-error';
/**
 * Raw upstream Emporix Return fields backing each sortable column (see resources/emporix/returns.yml).
 * Customer sorts by `requestor.firstName` (the first sub-field of the displayed name), mirroring the
 * Approvals Requestor/Approver pattern. Order Number has no entry here: `getFirstOrderId` reads
 * `orders[0].id` from the return's `orders[]` array, a cross-order aggregate with no single raw
 * sortable field, so that column stays non-sortable.
 */
const RETURN_SORT_FIELD_MAP: Record<ReturnSortField, string> = {
  date: 'metadata.createdAt',
  status: 'approvalStatus',
  returnNumber: 'id',
  netValue: 'calculatedPrice.finalPrice.netValue',
  reason: 'reason.code',
  customer: 'requestor.firstName',
};
const INITIAL_PAGE_SORT = 'metadata.createdAt:DESC';

interface ReturnsListProps {
  initialReturns?: Return[];
  forceRefreshOnMount?: boolean;
  initialTotalCount?: number;
}

export function ReturnsList({
  initialReturns,
  forceRefreshOnMount = false,
  initialTotalCount,
}: Readonly<ReturnsListProps>) {
  const t = useTranslations('account.returns');
  const tGroups = useTranslations('account.sidebar.groups');
  const returnErrorMessage = useReturnErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const [quickSearch, setQuickSearch] = useState('');
  const [sortField, setSortField] = useState<ReturnSortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [normalizedSearch, setNormalizedSearch] = useState('');

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      const nextNormalizedSearch = quickSearch.trim();
      if (nextNormalizedSearch === normalizedSearch) {
        return;
      }

      setCurrentPage((prev) => (prev === 1 ? prev : 1));
      setNormalizedSearch(nextNormalizedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [quickSearch, normalizedSearch]);

  const apiSort = `${RETURN_SORT_FIELD_MAP[sortField]}:${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;
  const apiQuery = normalizedSearch.length > 0 ? `id:~(${normalizedSearch})` : undefined;

  const {
    returns: visibleReturns,
    totalCount,
    loading,
    error,
    refreshReturns,
  } = useReturns(initialReturns, {
    pageNumber: currentPage,
    pageSize: RETURNS_PER_PAGE,
    sort: apiSort,
    query: apiQuery,
    forceRefreshOnMount,
    initialTotalCount,
    initialRequest: {
      pageNumber: 1,
      pageSize: RETURNS_PER_PAGE,
      sort: INITIAL_PAGE_SORT,
      query: undefined,
    },
  });

  const hasServerTotalCount = totalCount !== undefined;
  const hasNextPage = hasServerTotalCount
    ? currentPage < Math.ceil(totalCount / RETURNS_PER_PAGE)
    : visibleReturns.length === RETURNS_PER_PAGE;
  const fallbackTotalPages = hasNextPage ? currentPage + 1 : currentPage;
  const totalPages = hasServerTotalCount
    ? Math.max(1, Math.ceil(totalCount / RETURNS_PER_PAGE))
    : Math.max(currentPage, fallbackTotalPages);
  const isInitialLoading = loading && visibleReturns.length === 0 && !quickSearch && currentPage === 1;
  const isTableReloading = loading && !isInitialLoading;

  const toggleSort = (field: ReturnSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: ReturnSortField) => {
    if (isTableReloading && sortField === field) {
      return <Spinner variant="sm" color="primary" className="h-4 w-4" loadingText={t('loading')} />;
    }
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    return <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: ReturnSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) {
      return 'none';
    }

    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHead = (field: ReturnSortField, label: string, className: string, centered = false) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn('flex items-center gap-2 hover:text-text-action', centered && 'mx-auto')}
        data-testid={`returns-sort-${field}`}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // The debounce lags behind the input, so a plain refresh would repeat the term that just failed.
  const handleRetry = () => {
    const nextNormalizedSearch = quickSearch.trim();
    if (nextNormalizedSearch !== normalizedSearch) {
      setCurrentPage(1);
      setNormalizedSearch(nextNormalizedSearch);
      return;
    }

    void refreshReturns();
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (hasServerTotalCount ? Math.min(prev + 1, totalPages) : prev + 1));
  };

  const isSearchFailure =
    normalizedSearch.length > 0 &&
    error instanceof ReturnApiError &&
    error.code === RETURN_ERROR_CODE.RETURNS_FETCH_FAILED;
  const errorMessage = isSearchFailure
    ? t('errorLoadingSearch', { term: normalizedSearch })
    : (returnErrorMessage(error) ?? t('errorLoading'));

  return (
    <div className="space-y-6">
      <AccountPageHeader eyebrow={tGroups('orderManagement')} title={t('title')} description={t('description')} />

      <div className="space-y-6">
        <div>
          <div className="relative w-full max-w-[380px]">
            <Input
              value={quickSearch}
              onChange={(event) => {
                setQuickSearch(event.target.value);
              }}
              placeholder={t('searchPlaceholder')}
              className="pr-10"
              endIcon={isTableReloading ? undefined : Search}
              aria-label={t('searchPlaceholder')}
              aria-invalid={isSearchFailure}
              aria-describedby={error ? ERROR_MESSAGE_ID : undefined}
              data-testid="returns-search"
            />
            {isTableReloading && (
              <Spinner
                variant="sm"
                color="primary"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                loadingText={t('loading')}
              />
            )}
          </div>
        </div>

        {error && (
          <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 space-y-3">
            {/* The button stays out of the live region: it would be read as part of the field description. */}
            <p id={ERROR_MESSAGE_ID} role="alert">
              {errorMessage}
            </p>
            <Button onClick={handleRetry} data-testid="returns-retryButton">
              {t('tryAgain')}
            </Button>
          </div>
        )}
        {!error && isInitialLoading && (
          <AccountListContainer className="flex justify-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Spinner color="primary" variant="md" />
              <div>{t('loading')}</div>
            </div>
          </AccountListContainer>
        )}
        {!error && !isInitialLoading && (
          <AccountListContainer>
            <div
              className={`transition-opacity ${isTableReloading ? 'opacity-70' : 'opacity-100'}`}
              aria-busy={isTableReloading}
            >
              <Table>
                <TableHeader>
                  <TableRow className={accountTableHeadRowClass}>
                    {renderSortableHead('returnNumber', t('returnNumber'), accountTableHeadClass)}
                    {renderSortableHead('date', t('returnDate'), accountTableHeadClass)}
                    <TableHead className={accountTableHeadClass}>{t('orderNumber')}</TableHead>
                    {renderSortableHead('netValue', t('netReturnValue'), accountTableHeadClass)}
                    {renderSortableHead('reason', t('reasonLabel'), accountTableHeadClass)}
                    {renderSortableHead('status', t('statusLabel'), accountTableBadgeHeadClass, true)}
                    <TableHead className={cn(accountTableHeadClass, 'w-[100px] text-center')}>{t('action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && visibleReturns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-text-placeholders">
                        {quickSearch ? t('noMatches') : t('noReturns')}
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleReturns.map((returnItem, index) => {
                    const returnHref = `/account/returns/${returnItem.id}`;
                    const rowAriaLabel = t('viewReturnAriaLabel', { id: returnItem.id });
                    const netValue = getNetReturnValue(returnItem);
                    const reasonCode = getReturnReasonCode(returnItem);
                    const firstOrderId = getFirstOrderId(returnItem);
                    const hasFirstOrderId = firstOrderId !== '-';

                    return (
                      <TableRow
                        key={returnItem.id}
                        className={cn(
                          accountTableRowClass(index, { clickable: true }),
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                        )}
                        tabIndex={0}
                        aria-label={rowAriaLabel}
                        data-testid={`returns-row-${returnItem.id}`}
                        onClick={() => router.push(returnHref)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) {
                            return;
                          }

                          if (event.key === 'Enter') {
                            event.preventDefault();
                            router.push(returnHref);
                          }
                        }}
                      >
                        <TableCell className="px-2 py-4 font-medium">
                          <span title={returnItem.id}>
                            <UiLink
                              type="Link"
                              href={returnHref}
                              variant="primary"
                              onClick={(event) => event.stopPropagation()}
                              data-testid={`returns-id-${returnItem.id}`}
                            >
                              {shortenId(returnItem.id)}
                            </UiLink>
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-4">{formatReturnDate(returnItem.createdAt, locale)}</TableCell>
                        <TableCell className="px-2 py-4">
                          {hasFirstOrderId ? (
                            <UiLink
                              type="Link"
                              href={`/account/orders/${firstOrderId}`}
                              variant="text"
                              title={firstOrderId}
                              onClick={(event) => event.stopPropagation()}
                              data-testid={`returns-relatedOrder-${firstOrderId}`}
                            >
                              {shortenId(firstOrderId)}
                            </UiLink>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-4 font-medium">
                          {formatReturnCurrency(netValue.value, netValue.currency, locale)}
                        </TableCell>
                        <TableCell className="px-2 py-4">
                          {reasonCode ? renderReturnReasonLabel(t, reasonCode) : '-'}
                        </TableCell>
                        <TableCell className={accountTableBadgeCellClass}>
                          <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
                        </TableCell>
                        <TableCell className="px-2 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <UiLink
                              type="Link"
                              href={returnHref}
                              variant="table"
                              onClick={(event) => event.stopPropagation()}
                              aria-label={t('viewReturnAriaLabel', { id: returnItem.id })}
                              data-testid={`returns-view-${returnItem.id}`}
                            >
                              <ArrowRight className="h-6 w-6" />
                            </UiLink>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
              onPreviousPage={handlePreviousPage}
              onNextPage={handleNextPage}
            />
          </AccountListContainer>
        )}
      </div>
    </div>
  );
}
