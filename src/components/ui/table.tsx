'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({
  className,
  containerClassName,
  card = false,
  children,
  ...props
}: React.ComponentProps<'table'> & { containerClassName?: string; card?: boolean }) {
  const table = (
    <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props}>
      {children}
    </table>
  );

  const content = (
    <div data-slot="table-container" className={cn('relative w-full max-w-full overflow-x-auto', containerClassName)}>
      {table}
    </div>
  );

  if (!card) {
    return content;
  }

  return <TableCard>{content}</TableCard>;
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-surface-disabled border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-surface-disabled data-[state=selected]:bg-surface-disabled border-b transition-colors',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-text-headings h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption data-slot="table-caption" className={cn('text-text-on-disabled mt-4 text-sm', className)} {...props} />
  );
}

/**
 * Shared card surface for account-list tables. Wrap a list's search/filter controls, `Table`,
 * and `TablePagination` in this component so every account list (Orders, Returns, Quotes,
 * Approvals) renders inside the same light card: a subtle border, rounded corners, and shadow,
 * matching the Figma account-list reference (`TYdPJprCUxuqn564qa9urk`, node `6354:68087`).
 *
 * The shadow references the `--theme-shadow-sm` design token directly (rather than the
 * `shadow-sm` Tailwind scale utility) so this single centralized declaration stays explicitly
 * tied to the Figma-recorded value even if the generic Tailwind shadow scale is retuned later.
 * Do not add a domain-specific shadow override on top of this.
 */
function TableCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="table-card"
      className={cn(
        'bg-surface-primary border border-border-primary rounded-md p-4 shadow-[var(--theme-shadow-sm)] min-[768px]:p-6',
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, TableCard };
