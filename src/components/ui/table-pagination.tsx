'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageIndicator: string;
  previousLabel: string;
  nextLabel: string;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageIndicator,
  previousLabel,
  nextLabel,
  onPreviousPage,
  onNextPage,
  className,
}: TablePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-4 py-4', className)}>
      <p className="font-body text-right text-sm leading-5 whitespace-nowrap text-text-body">{pageIndicator}</p>
      {canPrev && onPreviousPage ? (
        <Button variant="neutral" size="small" onClick={onPreviousPage}>
          <ChevronLeft className="size-6 shrink-0" aria-hidden />
          {previousLabel}
        </Button>
      ) : null}
      {canNext && onNextPage ? (
        <Button variant="neutral" size="small" onClick={onNextPage}>
          {nextLabel}
          <ChevronRight className="size-6 shrink-0" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
