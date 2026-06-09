'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import AccountLayout from '@/components/account/account-layout';
import { QuotesTable } from '@/components/account/quotes/quotes-table';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useQuotes } from '@/hooks/quotes/useQuotes';
import type { Quote } from '@/platform/services/model/quote';

const SEARCH_DEBOUNCE_MS = 500;

interface QuotesPageContentProps {
  initialQuotes?: Quote[];
}

export default function QuotesPageContent({ initialQuotes }: QuotesPageContentProps) {
  const t = useTranslations('account.quotesList');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const quotesPerPage = 5;

  const [quickSearch, setQuickSearch] = useState('');
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();
  const apiQuery =
    normalizedSearch.length > 0
      ? `compoundLogicalQuery:((status.value:~(${normalizedSearch.toUpperCase()})) OR (id:~(${normalizedSearch})) OR (mixins.additionalInfo.reference:~(${normalizedSearch})) OR (customer.firstName:~(${normalizedSearch})) OR (customer.lastName:~(${normalizedSearch})) OR (employee.firstName:~(${normalizedSearch})) OR (employee.lastName:~(${normalizedSearch})))`
      : undefined;

  const { quotes, loading, error, pagination } = useQuotes(initialQuotes, {
    query: apiQuery,
    page: currentPage - 1,
    size: quotesPerPage,
  });

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    const totalPages = pagination?.totalPages ?? 1;
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const isSearchLoading = loading && normalizedSearch.length > 0;

  return (
    <AccountLayout>
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

        {!loading && quotes.length === 0 && normalizedSearch.length > 0 && (
          <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">
            {t('noMatches')}
          </div>
        )}

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
          />
        )}
      </div>
    </AccountLayout>
  );
}
