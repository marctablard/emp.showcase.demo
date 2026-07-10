'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { accountTableHeadClass, accountTableHeadRowClass, shortenId } from './account-list';

export interface AccountProductLine {
  /** Product id shown (and truncated) in the first column. */
  id: string;
  imageUrl?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  currency?: string;
}

/**
 * Inline product breakdown rendered inside an expanded account list row
 * (orders / quotes / approvals). Lists each product with its vignette, id,
 * quantity, unit price and computed total price. Styling mirrors the account
 * list tables (square corners, shared head classes).
 */
export function AccountProductLines({ lines }: { lines: AccountProductLine[] }) {
  const t = useTranslations('account.productBreakdown');

  if (!lines || lines.length === 0) {
    return <p className="px-6 py-4 text-sm text-text-placeholders sm:px-8">{t('empty')}</p>;
  }

  return (
    <div className="bg-surface-image-background/40 px-6 py-4 sm:px-8">
      <Table>
        <TableHeader>
          <TableRow className={accountTableHeadRowClass}>
            <TableHead className={accountTableHeadClass}>{t('product')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-28 text-center')}>{t('quantity')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-40 text-right')}>{t('unitPrice')}</TableHead>
            <TableHead className={cn(accountTableHeadClass, 'w-40 text-right')}>{t('totalPrice')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => {
            const total = line.unitPrice != null ? line.unitPrice * line.quantity : undefined;

            return (
              <TableRow key={`${line.id}-${index}`} className="text-sm xl:text-base">
                <TableCell className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-border-primary bg-surface-image-background">
                      {line.imageUrl ? (
                        <Image
                          src={line.imageUrl}
                          alt={line.name || ''}
                          width={40}
                          height={40}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package className="h-4 w-4 text-icon-secondary opacity-40" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      {line.name ? <p className="truncate font-medium text-text-headings">{line.name}</p> : null}
                      <span className="text-xs text-text-placeholders" title={line.id}>
                        {shortenId(line.id)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-3 text-center tabular-nums">{line.quantity}</TableCell>
                <TableCell className="px-2 py-3 text-right tabular-nums">
                  {line.unitPrice != null && line.currency ? formatCurrency(line.unitPrice, line.currency) : '–'}
                </TableCell>
                <TableCell className="px-2 py-3 text-right font-medium tabular-nums">
                  {total != null && line.currency ? formatCurrency(total, line.currency) : '–'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default AccountProductLines;
