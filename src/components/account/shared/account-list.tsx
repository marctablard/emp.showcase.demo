import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bordered surface that wraps a list table (orders / quotes / approvals / …).
 * Mirrors the framed `AccountDetailContainer` used on detail pages so list and
 * detail views share the same border / background language.
 */
export function AccountListContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('border border-border-primary bg-surface-page', className)}>{children}</section>;
}

/**
 * Toolbar strip (search / filters) rendered above or inside a list container.
 * Keeps the search + filter row consistent across list pages.
 */
export function AccountListToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 border-b border-border-primary px-4 py-3 sm:px-6', className)}
    >
      {children}
    </div>
  );
}

/**
 * Canonical header-cell class for every account list table. Base-size, bold,
 * sentence-case labels on the heading colour — the treatment we standardized on
 * from the orders / quotes tables. Use `cn(accountTableHeadClass, 'text-right')`
 * etc. for per-column alignment.
 */
export const accountTableHeadClass = '!h-14 whitespace-nowrap px-2 text-sm xl:text-base font-bold text-text-headings';

/** Canonical body-cell class for account list tables. */
export const accountTableCellClass = 'px-2 py-4 align-middle text-sm xl:text-base text-text-body';

/**
 * Middle-truncate a long identifier for list display (e.g. long ticket / return
 * IDs). The full value should still be exposed via a `title` attribute.
 *
 * @example shortenId('TKT-1783498400993852916') // 'TKT-1783…852916'
 */
export function shortenId(id: string, head = 8, tail = 6): string {
  if (!id || id.length <= head + tail + 3) {
    return id;
  }
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
