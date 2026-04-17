'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useReturns } from '@/hooks/return/useReturns';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Link } from '@/i18n/navigation';
import type { Return } from '@/platform/services/model/return';
import { formatReturnCurrency, formatReturnDate, getFirstOrderId, getRequestorEmail } from './helpers';
import { ReturnStatusBadge } from './return-status-badge';

type ReturnSortField = 'date' | 'value' | 'status';
const RETURNS_PER_PAGE = 5;
const SEARCH_DEBOUNCE_MS = 500;
const RETURN_SORT_FIELD_MAP: Record<ReturnSortField, string> = {
  date: 'metadata.createdAt',
  value: 'total.value',
  status: 'approvalStatus',
};

interface ReturnsListProps {
  initialReturns?: Return[];
  forceRefreshOnMount?: boolean;
}

export function ReturnsList({ initialReturns, forceRefreshOnMount = false }: ReturnsListProps) {
  const t = useTranslations('account.returns');
  const locale = useLocale();
  const [quickSearch, setQuickSearch] = useState('');
  const [debouncedQuickSearch, setDebouncedQuickSearch] = useState('');
  const [sortField, setSortField] = useState<ReturnSortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const isTabletUp = useBreakpoint('sm');
  const normalizedSearch = debouncedQuickSearch.trim();
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
  });
  const hasNextPage =
    totalCount !== undefined
      ? currentPage < Math.ceil(totalCount / RETURNS_PER_PAGE)
      : visibleReturns.length === RETURNS_PER_PAGE;
  const totalPages =
    totalCount !== undefined
      ? Math.max(1, Math.ceil(totalCount / RETURNS_PER_PAGE))
      : Math.max(currentPage, currentPage + (hasNextPage ? 1 : 0));
  const isInitialLoading = loading && visibleReturns.length === 0 && !quickSearch && currentPage === 1;
  const isTableReloading = loading && !isInitialLoading;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuickSearch(quickSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [quickSearch]);

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
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    return <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: ReturnSortField): 'none' | 'ascending' | 'descending' =>
    sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const getDisplayReturnAmount = (returnItem: Return) => ({
    value: returnItem.calculatedPrice?.finalPrice?.grossValue ?? returnItem.total?.value,
    currency:
      returnItem.calculatedPrice?.finalPrice?.currency ??
      returnItem.total?.currency ??
      returnItem.orders[0]?.items[0]?.total?.currency ??
      returnItem.orders[0]?.items[0]?.unitPrice?.currency,
  });

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

      <div className="bg-surface-primary border border-border-primary rounded-md p-4 min-[768px]:p-6 shadow-sm">
        <div className="mb-4">
          <div className="relative w-full max-w-[380px]">
            <Input
              value={quickSearch}
              onChange={(event) => {
                setCurrentPage(1);
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

        {!loading && visibleReturns.length === 0 && quickSearch && (
          <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">
            {t('noMatches')}
          </div>
        )}

        {isTabletUp && (
          <div className={`transition-opacity ${isTableReloading ? 'opacity-70' : 'opacity-100'}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold text-base leading-5 font-primary text-text-headings">
                    {t('returnNumber')}
                  </TableHead>
                  <TableHead
                    className="font-bold text-base leading-5 font-primary text-text-headings"
                    aria-sort={getSortAriaSort('date')}
                  >
                    <button
                      onClick={() => toggleSort('date')}
                      className="flex items-center gap-2 hover:text-text-action"
                    >
                      {t('returnDate')}
                      {getSortIcon('date')}
                    </button>
                  </TableHead>
                  <TableHead className="font-bold text-base leading-5 font-primary text-text-headings">
                    {t('orderNumber')}
                  </TableHead>
                  <TableHead className="hidden min-[1280px]:table-cell font-bold text-base leading-5 font-primary text-text-headings">
                    {t('email')}
                  </TableHead>
                  <TableHead
                    className="font-bold text-base leading-5 font-primary text-text-headings"
                    aria-sort={getSortAriaSort('value')}
                  >
                    <button
                      onClick={() => toggleSort('value')}
                      className="flex items-center gap-2 hover:text-text-action"
                    >
                      {t('returnValue')}
                      {getSortIcon('value')}
                    </button>
                  </TableHead>
                  <TableHead
                    className="font-bold text-base leading-5 font-primary text-text-headings"
                    aria-sort={getSortAriaSort('status')}
                  >
                    <button
                      onClick={() => toggleSort('status')}
                      className="flex items-center gap-2 hover:text-text-action"
                    >
                      {t('statusLabel')}
                      {getSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="font-bold text-base leading-5 font-primary text-text-headings text-right">
                    {t('view')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReturns.map((returnItem) => {
                  const displayAmount = getDisplayReturnAmount(returnItem);
                  return (
                    <TableRow key={returnItem.id} className="border-t border-border-primary">
                      <TableCell>
                        <Link
                          href={`/account/returns/${returnItem.id}`}
                          className="text-text-action underline decoration-solid font-bold hover:text-text-action/80"
                        >
                          {returnItem.id}
                        </Link>
                      </TableCell>
                      <TableCell>{formatReturnDate(returnItem.createdAt, locale)}</TableCell>
                      <TableCell>{getFirstOrderId(returnItem)}</TableCell>
                      <TableCell className="hidden min-[1280px]:table-cell">{getRequestorEmail(returnItem)}</TableCell>
                      <TableCell>{formatReturnCurrency(displayAmount.value, displayAmount.currency, locale)}</TableCell>
                      <TableCell>
                        <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/account/returns/${returnItem.id}`}
                          className="inline-flex items-center justify-end"
                        >
                          <ArrowRight className="h-6 w-6 text-text-headings hover:text-text-action" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!isTabletUp && (
          <div className={`space-y-3 transition-opacity ${isTableReloading ? 'opacity-70' : 'opacity-100'}`}>
            {visibleReturns.map((returnItem) => {
              const displayAmount = getDisplayReturnAmount(returnItem);
              return (
                <Card key={returnItem.id} className="border border-border-primary shadow-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/account/returns/${returnItem.id}`}
                          className="text-text-action underline decoration-solid font-bold hover:text-text-action/80 break-all"
                        >
                          {returnItem.id}
                        </Link>
                        <div className="text-xs text-text-on-disabled mt-1">
                          {formatReturnDate(returnItem.createdAt, locale)}
                        </div>
                      </div>
                      <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-text-on-disabled">{t('orderNumber')}: </span>
                        <span>{getFirstOrderId(returnItem)}</span>
                      </div>
                      <div>
                        <span className="text-text-on-disabled">{t('email')}: </span>
                        <span className="break-all">{getRequestorEmail(returnItem)}</span>
                      </div>
                      <div>
                        <span className="text-text-on-disabled">{t('returnValue')}: </span>
                        <span>{formatReturnCurrency(displayAmount.value, displayAmount.currency, locale)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Link href={`/account/returns/${returnItem.id}`} className="inline-flex items-center justify-end">
                        <ArrowRight className="h-6 w-6 text-text-headings hover:text-text-action" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
      </div>
    </div>
  );
}
