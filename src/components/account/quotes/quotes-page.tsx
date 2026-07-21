'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { QUOTES_PER_PAGE } from '@/components/account/account-table-constants';
import { QUOTE_SORT_FIELD_MAP, type QuoteSortField, QuotesTable } from '@/components/account/quotes/quotes-table';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useQuotes } from '@/hooks/quotes/useQuotes';
import type { Quote } from '@/platform/services/model/quote';

const SEARCH_DEBOUNCE_MS = 500;
const INITIAL_PAGE_SORT = 'metadata.createdAt:DESC';

interface QuotesPageContentProps {
  initialQuotes?: Quote[];
  initialTotalCount?: number;
}

export default function QuotesPageContent({ initialQuotes, initialTotalCount }: Readonly<QuotesPageContentProps>) {
  const t = useTranslations('account.quotesList');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<QuoteSortField>('quotationDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [quickSearch, setQuickSearch] = useState('');
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  // Quick search is scoped to Quote ID and Quote Reference only, using the raw
  // upstream fields (`id`, `customerReference`) rather than the mapper-derived
  // `reference` fallback field.
  const apiQuery =
    normalizedSearch.length > 0
      ? `compoundLogicalQuery:((id:~(${normalizedSearch})) OR (customerReference:~(${normalizedSearch})))`
      : undefined;
  const apiSort = `${QUOTE_SORT_FIELD_MAP[sortField]}:${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;

  const { quotes, loading, error, pagination } = useQuotes(initialQuotes, {
    query: apiQuery,
    page: currentPage - 1,
    size: QUOTES_PER_PAGE,
    sort: apiSort,
    initialTotalCount,
    initialRequest: {
      page: 0,
      size: QUOTES_PER_PAGE,
      sort: INITIAL_PAGE_SORT,
      query: undefined,
    },
  });

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    const totalPages = pagination?.totalPages ?? 1;
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const toggleSort = (field: QuoteSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const isSearchLoading = loading && normalizedSearch.length > 0;

  return (
    <div className="space-y-6">
      <H1>{t('title')}</H1>

      <div className="mb-4 w-full max-w-[380px]">
        <div className="relative w-full">
          <Input
            value={quickSearch}
            onChange={(event) => {
              setCurrentPage(1);
              setQuickSearch(event.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            className="pr-10"
            endIcon={isSearchLoading ? undefined : Search}
            aria-label={t('searchPlaceholder')}
          />
          {isSearchLoading && (
            <Spinner
              variant="sm"
              color="primary"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              loadingText={t('title')}
            />
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded">
          {error.message}
        </div>
      ) : (
        <QuotesTable
          quotes={quotes}
          loading={loading}
          currentPage={currentPage}
          totalPages={pagination?.totalPages ?? 1}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          sortField={sortField}
          sortDirection={sortDirection}
          onToggleSort={toggleSort}
          hasActiveSearch={normalizedSearch.length > 0}
        />
      )}
    </div>
  );
}
