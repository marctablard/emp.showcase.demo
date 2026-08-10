'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useReturns } from '@/hooks/return/useReturns';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Return } from '@/platform/services/model/return';
import {
  formatReturnCurrency,
  formatReturnDate,
  getFirstOrderId,
  getNetReturnValue,
  getReturnReasonCode,
} from './helpers';
import { renderReturnReasonLabel } from './reason-labels';
import { ReturnStatusBadge } from './return-status-badge';

type ReturnSortField = 'date' | 'status' | 'returnNumber' | 'netValue' | 'reason' | 'customer';
const RETURNS_PER_PAGE = 5;
const SEARCH_DEBOUNCE_MS = 500;
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

  const renderSortableHead = (field: ReturnSortField, label: string, className: string) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="flex items-center gap-2 hover:text-text-action"
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (hasServerTotalCount ? Math.min(prev + 1, totalPages) : prev + 1));
  };

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[48px] font-bold leading-[52px]">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="flex flex-col items-center space-y-2">
            <Spinner color="primary" variant="md" />
            <div>{t('loading')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[48px] font-bold leading-[52px]">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">
            {t('errorLoading')}: {error.message}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refreshReturns()}>{t('tryAgain')}</Button>
        </CardFooter>
      </Card>
    );
  }

  if (visibleReturns.length === 0 && !quickSearch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[48px] font-bold leading-[52px]">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-text-placeholders">{t('noReturns')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[40px] leading-[44px] lg:text-[52px] lg:leading-[56px] font-bold text-text-headings font-primary">
        {t('title')}
      </h1>

      <TableCard className="overflow-hidden">
        <div className="mb-4">
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

        <div
          className={`transition-opacity ${isTableReloading ? 'opacity-70' : 'opacity-100'}`}
          aria-busy={isTableReloading}
        >
          <Table containerClassName="pr-1">
            <TableHeader>
              <TableRow className="text-base">
                {renderSortableHead('returnNumber', t('returnNumber'), '!h-14 w-[180px] font-bold')}
                {renderSortableHead('date', t('returnDate'), '!h-14 w-[160px] font-bold')}
                {renderSortableHead('status', t('statusLabel'), '!h-14 w-[140px] font-bold')}
                <TableHead className="!h-14 w-[160px] font-bold">{t('orderNumber')}</TableHead>
                {renderSortableHead('netValue', t('netReturnValue'), '!h-14 w-[180px] font-bold')}
                {renderSortableHead('reason', t('reasonLabel'), '!h-14 w-[160px] font-bold')}
                <TableHead className="!h-14 w-[100px] font-bold text-center">{t('action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && visibleReturns.length === 0 && quickSearch && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    {t('noMatches')}
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
                      'hover:bg-surface-image-background cursor-pointer text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                    )}
                    tabIndex={0}
                    aria-label={rowAriaLabel}
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
                      <UiLink
                        type="Link"
                        href={returnHref}
                        variant="table"
                        className="font-bold"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {returnItem.id}
                      </UiLink>
                    </TableCell>
                    <TableCell className="px-2 py-4">{formatReturnDate(returnItem.createdAt, locale)}</TableCell>
                    <TableCell className="px-2 py-4">
                      <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
                    </TableCell>
                    <TableCell className="px-2 py-4">
                      {hasFirstOrderId ? (
                        <UiLink
                          type="Link"
                          href={`/account/orders/${firstOrderId}`}
                          variant="table"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {firstOrderId}
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
                    <TableCell className="px-2 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <UiLink
                          type="Link"
                          href={returnHref}
                          variant="table"
                          onClick={(event) => event.stopPropagation()}
                          aria-label={t('viewReturnAriaLabel', { id: returnItem.id })}
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
      </TableCard>
    </div>
  );
}
