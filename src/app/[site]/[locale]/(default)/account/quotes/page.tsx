'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import AccountLayout from '@/components/account/account-layout';
import { QuotesTable } from '@/components/account/quotes/quotes-table';
import { H1 } from '@/components/ui/h';
import { useQuotes } from '@/hooks/quotes/useQuotes';

export const dynamic = 'force-dynamic';

export default function QuotesPage() {
  const t = useTranslations('account.quotesList');
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const quotesPerPage = 5;

  const { quotes, loading, error } = useQuotes();

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    if (quotes) {
      const maxPage = Math.ceil(quotes.length / quotesPerPage);
      setCurrentPage((prev) => Math.min(prev + 1, maxPage));
    }
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <H1>{t('title')}</H1>

        {error ? (
          <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded">
            {error.message}
          </div>
        ) : (
          <QuotesTable
            quotes={quotes}
            loading={loading}
            currentPage={currentPage}
            quotesPerPage={quotesPerPage}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
          />
        )}
      </div>
    </AccountLayout>
  );
}
