'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight, Minus, Package, Plus } from 'lucide-react';
import { OrderStatusBadge } from '@/components/account/orders/order-status-badge';
import { accountTableHeadClass, shortenId } from '@/components/account/shared/account-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getQuoteStatusDisplayLabel } from '@/lib/common/quote-status-message-keys';
import { isOrderStatusValue, normalizeStatusKey } from '@/lib/common/status-tag-variants';
import { cn } from '@/lib/utils';
import type { OrderItemData } from '../types';
import { extractPrice, formatPrice, getQuoteStatusBadgeVariantForAi } from '../utils';

/**
 * Chat widgets follow the My Account list/detail language (square corners, thin borders, uppercase
 * section labels, zebra rows) at a smaller scale. Each widget renders exactly one frame; sections
 * inside it are separated by dividers, never by nested boxes.
 */
export const aiWidgetPaddingX = 'px-4';

export const aiTableHeadClass = cn(accountTableHeadClass, '!h-10 text-xs');
export const aiTableCellClass = 'px-2 py-2.5 align-middle text-sm text-text-body';

export function AiWidgetFrame({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div className={cn('w-full overflow-hidden border border-border-primary bg-surface-page text-sm', className)}>
      {children}
    </div>
  );
}

interface AiWidgetHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode[];
}

export function AiWidgetHeader({ eyebrow, title, aside, meta }: Readonly<AiWidgetHeaderProps>) {
  const metaItems = (meta ?? []).filter(Boolean);
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-border-primary py-3', aiWidgetPaddingX)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-placeholders">{eyebrow}</p>
        ) : null}
        <div className="truncate text-base font-bold text-text-headings">{title}</div>
        {metaItems.length > 0 ? (
          <p className="mt-0.5 text-xs text-text-placeholders">
            {metaItems.map((item, index) => (
              <span key={index}>
                {index > 0 ? ' · ' : null}
                {item}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function AiSectionLabel({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <p className={cn('mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-headings', className)}>
      {children}
    </p>
  );
}

export function AiWidgetSection({
  label,
  className,
  children,
}: Readonly<{ label?: ReactNode; className?: string; children: ReactNode }>) {
  return (
    <section className={cn('border-b border-border-primary py-3 last:border-b-0', aiWidgetPaddingX, className)}>
      {label ? <AiSectionLabel>{label}</AiSectionLabel> : null}
      {children}
    </section>
  );
}

export type AiSpecEntry = { key: string; label: ReactNode; value: ReactNode };

export function AiSpecGrid({ entries }: Readonly<{ entries: AiSpecEntry[] }>) {
  const visible = entries.filter((entry) => entry.value != null && entry.value !== '');
  if (visible.length === 0) {
    return null;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {visible.map((entry) => (
        <div key={entry.key} className="min-w-0">
          <dt className="text-xs text-text-placeholders">{entry.label}</dt>
          <dd className="break-words text-sm text-text-body">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type AiTotalRow = { key: string; label: ReactNode; value: ReactNode; emphasized?: boolean };

export function AiTotals({ rows }: Readonly<{ rows: AiTotalRow[] }>) {
  return (
    <dl className="ml-auto w-full max-w-xs space-y-1">
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn(
            'flex items-baseline justify-between gap-4 tabular-nums',
            row.emphasized && 'mt-1 border-t border-border-primary pt-2 font-bold text-text-headings',
          )}
        >
          <dt className={cn(!row.emphasized && 'text-text-placeholders')}>{row.label}</dt>
          <dd className={cn(row.emphasized ? 'text-base' : 'text-text-body')}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AiWidgetFooterLink({
  href,
  testId,
  children,
}: Readonly<{ href: string; testId: string; children: ReactNode }>) {
  return (
    <div className={cn('flex justify-end border-t border-border-primary py-2.5', aiWidgetPaddingX)}>
      <UiLink type="Link" href={href} variant="primary" data-testid={testId} className="inline-flex items-center gap-1">
        {children}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </UiLink>
    </div>
  );
}

export function AiThumbnail({ src, alt, size = 40 }: Readonly<{ src?: string; alt: string; size?: number }>) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden border border-border-primary bg-surface-image-background"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} width={size} height={size} className="h-full w-full object-contain" unoptimized />
      ) : (
        <Package className="h-4 w-4 text-icon-secondary opacity-40" aria-hidden="true" />
      )}
    </span>
  );
}

export interface AiProductLine {
  id?: string;
  name: string;
  imageUrl?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  note?: ReactNode;
  href?: string;
}

export function orderItemToLine(item: OrderItemData, currency: string): AiProductLine {
  const quantity = item.quantity || 0;
  const unitNet = item.unitPrice ? extractPrice(item.unitPrice).net : 0;
  const totalNet = item.totalPrice ? extractPrice(item.totalPrice).net : 0;
  return {
    id: item.productId,
    name: item.name,
    imageUrl: item.image,
    quantity,
    unitPrice: unitNet || (totalNet && quantity ? totalNet / quantity : undefined),
    totalPrice: totalNet || undefined,
    currency: item.unitPrice?.currency || item.totalPrice?.currency || currency,
    href: item.productId ? `/product/${item.productId}` : undefined,
  };
}

/** Agent statuses are free text; known order statuses get the My Account badge. */
export function AiOrderStatus({ status }: Readonly<{ status?: string }>) {
  if (!status) {
    return null;
  }
  const key = normalizeStatusKey(status);
  if (isOrderStatusValue(key)) {
    return <OrderStatusBadge status={key} />;
  }
  return (
    <Badge variant="outline" size="status">
      {status}
    </Badge>
  );
}

export function AiQuoteStatus({ status }: Readonly<{ status?: string }>) {
  const t = useTranslations('account.quoteStatus');
  if (!status) {
    return null;
  }
  return (
    <Badge variant={getQuoteStatusBadgeVariantForAi(status)} size="status">
      {getQuoteStatusDisplayLabel(status, t)}
    </Badge>
  );
}

/** Compact product breakdown (vignette, name, quantity, unit and line total) for detail widgets. */
export function AiProductLines({ lines, testIdPrefix }: Readonly<{ lines: AiProductLine[]; testIdPrefix: string }>) {
  const t = useTranslations('account.productBreakdown');
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead className={cn(aiTableHeadClass, 'pl-4')}>{t('product')}</TableHead>
          <TableHead className={cn(aiTableHeadClass, 'w-14 text-center')}>{t('quantity')}</TableHead>
          <TableHead className={cn(aiTableHeadClass, 'w-24 text-right')}>{t('unitPrice')}</TableHead>
          <TableHead className={cn(aiTableHeadClass, 'w-24 pr-4 text-right')}>{t('totalPrice')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => {
          const total = line.totalPrice ?? (line.unitPrice != null ? line.unitPrice * (line.quantity ?? 1) : undefined);
          return (
            <TableRow key={`${line.id ?? line.name}-${index}`} className="text-sm hover:bg-transparent">
              <TableCell className={cn(aiTableCellClass, 'pl-4')}>
                <div className="flex items-center gap-3">
                  <AiThumbnail src={line.imageUrl} alt={line.name} size={36} />
                  <div className="min-w-0">
                    {line.href ? (
                      <UiLink
                        type="Link"
                        href={line.href}
                        variant="text"
                        className="line-clamp-2 font-medium text-text-headings"
                        data-testid={`${testIdPrefix}-product-${line.id ?? index}`}
                      >
                        {line.name}
                      </UiLink>
                    ) : (
                      <p className="line-clamp-2 font-medium text-text-headings">{line.name}</p>
                    )}
                    {line.id ? (
                      <span className="text-xs text-text-placeholders" title={line.id}>
                        {shortenId(line.id)}
                      </span>
                    ) : null}
                    {line.note ? <p className="text-xs text-text-placeholders">{line.note}</p> : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className={cn(aiTableCellClass, 'text-center tabular-nums')}>{line.quantity ?? '–'}</TableCell>
              <TableCell className={cn(aiTableCellClass, 'whitespace-nowrap text-right tabular-nums')}>
                {line.unitPrice ? formatPrice(line.unitPrice, line.currency) : '–'}
              </TableCell>
              <TableCell className={cn(aiTableCellClass, 'whitespace-nowrap pr-4 text-right font-medium tabular-nums')}>
                {total ? formatPrice(total, line.currency) : '–'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function AiQuantityStepper({
  value,
  onChange,
  testIdPrefix,
}: Readonly<{ value: number; onChange: (value: number) => void; testIdPrefix: string }>) {
  const t = useTranslations('account.AiHelper');
  return (
    <div className="inline-flex h-8 items-center border border-border-primary">
      <button
        type="button"
        className="flex h-full w-8 items-center justify-center text-text-body hover:bg-surface-image-background disabled:text-text-disabled"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label={`${t('quantity')} −`}
        data-testid={`${testIdPrefix}-decrease`}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="min-w-8 border-x border-border-primary px-2 text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        className="flex h-full w-8 items-center justify-center text-text-body hover:bg-surface-image-background"
        onClick={() => onChange(value + 1)}
        aria-label={`${t('quantity')} +`}
        data-testid={`${testIdPrefix}-increase`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AiAddress({
  address,
}: Readonly<{
  address: {
    name?: string;
    company?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}>) {
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ');
  return (
    <address className="text-sm not-italic leading-relaxed text-text-body">
      {address.name ? <div className="font-medium text-text-headings">{address.name}</div> : null}
      {address.company ? <div>{address.company}</div> : null}
      {address.addressLine1 ? <div>{address.addressLine1}</div> : null}
      {address.addressLine2 ? <div>{address.addressLine2}</div> : null}
      {cityLine || address.state ? <div>{[cityLine, address.state].filter(Boolean).join(', ')}</div> : null}
      {address.country ? <div>{address.country}</div> : null}
    </address>
  );
}

type AiAddressEntry = Parameters<typeof AiAddress>[0]['address'] & { id?: string; tags?: string[] };

interface AiAddressListProps {
  addresses: AiAddressEntry[];
  /** Rows with an id get a select action (checkout asks the shopper to pick an address). */
  onSelect?: (address: AiAddressEntry & { id: string }) => void;
  selectLabel?: string;
}

export function AiAddressList({ addresses, onSelect, selectLabel }: Readonly<AiAddressListProps>) {
  return (
    <ul className="divide-y divide-border-primary">
      {addresses.map((address, index) => (
        <li
          key={`${address.name ?? ''}-${address.addressLine1 ?? ''}-${index}`}
          className={cn('flex items-start justify-between gap-3 py-3', aiWidgetPaddingX)}
        >
          <AiAddress address={address} />
          <span className="flex shrink-0 flex-col items-end gap-2">
            {address.tags && address.tags.length > 0 ? (
              <span className="flex flex-wrap justify-end gap-1">
                {address.tags.map((tag) => (
                  <Badge key={tag} variant="outline" size="status">
                    {tag}
                  </Badge>
                ))}
              </span>
            ) : null}
            {onSelect && address.id ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                className="h-8 px-3 text-sm"
                onClick={() => onSelect({ ...address, id: address.id as string })}
                data-testid={`aiAddresses-select-${address.id}`}
              >
                {selectLabel}
              </Button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
