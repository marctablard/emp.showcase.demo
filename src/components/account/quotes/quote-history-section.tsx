'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface QuoteHistoryEntry {
  id: string;
  editor: string;
  action: ReactNode;
  comment: ReactNode;
  reason: string;
  date: string;
}

interface QuoteHistorySectionProps {
  entries: QuoteHistoryEntry[];
  loading?: boolean;
}

export function QuoteHistorySection({ entries, loading }: QuoteHistorySectionProps) {
  const t = useTranslations('account.quoteDetails');

  return (
    <section
      className="overflow-hidden rounded-md border border-border-primary/50 bg-surface-action-hover-2/40"
      data-testid="quote-history-section"
    >
      <div className="flex items-center gap-2 border-b border-border-primary/40 px-4 py-2.5">
        <History className="h-4 w-4 text-text-action" aria-hidden />
        <h3 className="text-sm font-bold font-headlines text-text-heading">{t('changeHistory')}</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-text-placeholders">
          <Spinner variant="sm" />
          {t('loadingHistory')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border-primary/40 bg-surface-page/60 hover:bg-surface-page/60">
              <TableHead className="h-9 min-w-[100px] px-3 text-xs font-medium uppercase tracking-wide text-text-placeholders">
                {t('editor')}
              </TableHead>
              <TableHead className="h-9 min-w-[120px] px-3 text-xs font-medium uppercase tracking-wide text-text-placeholders">
                {t('action')}
              </TableHead>
              <TableHead className="h-9 min-w-[140px] px-3 text-xs font-medium uppercase tracking-wide text-text-placeholders">
                {t('comment')}
              </TableHead>
              <TableHead className="h-9 min-w-[80px] px-3 text-xs font-medium uppercase tracking-wide text-text-placeholders">
                {t('reason')}
              </TableHead>
              <TableHead className="h-9 min-w-[120px] whitespace-nowrap px-3 text-end text-xs font-medium uppercase tracking-wide text-text-placeholders">
                {t('date')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow
                key={entry.id}
                className={cn('border-border-primary/30', index % 2 === 1 ? 'bg-surface-page/40' : 'bg-transparent')}
              >
                <TableCell className="px-3 py-2.5 align-top text-sm font-medium text-text-body">
                  {entry.editor}
                </TableCell>
                <TableCell className="px-3 py-2.5 align-top text-sm text-text-body">{entry.action}</TableCell>
                <TableCell className="max-w-[220px] px-3 py-2.5 align-top text-sm text-text-body lg:max-w-xs">
                  {entry.comment}
                </TableCell>
                <TableCell className="px-3 py-2.5 align-top text-sm text-text-placeholders">{entry.reason}</TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-end align-top text-sm text-text-placeholders">
                  {entry.date}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
