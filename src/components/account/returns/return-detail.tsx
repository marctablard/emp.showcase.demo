'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { AlertCircle, Package } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
} from '@/components/account/shared/account-detail';
import { AccountSpecTable, SpecRow } from '@/components/account/shared/account-spec-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReturn } from '@/hooks/return/useReturn';
import { Link } from '@/i18n/navigation';
import type { Return } from '@/platform/services/model/return';
import { formatReturnCurrency, formatReturnDate, getFirstOrderId, getRequestorEmail } from './helpers';
import { getReturnReasonLabel, getReturnReasonTranslationKey } from './reason-labels';
import { ReturnStatusBadge } from './return-status-badge';

interface ExtendedReturnItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: { value: number; currency: string };
  grossUnitPrice?: { value: number; currency: string };
  total?: { value: number; currency: string };
  netPrice?: { value: number; currency: string };
  calculatedUnitPrice?: {
    netValue: number;
    grossValue: number;
    taxValue: number;
    taxCode?: string;
    taxRate?: number;
    valid?: boolean;
    currency?: string;
  };
  calculatedPrice?: {
    finalPrice: {
      netValue: number;
      grossValue: number;
      taxValue: number;
      taxCode?: string;
      taxRate?: number;
      valid?: boolean;
      currency?: string;
    };
  };
  reason?: { code?: string; details?: string };
  images?: string[];
  brand?: string;
  vendorName?: string;
  itemNumber?: string;
  productId?: string;
}

interface ExtendedReturn extends Omit<Return, 'orders'> {
  orders: {
    id: string;
    items: ExtendedReturnItem[];
  }[];
}

type ReturnsTranslations = ReturnType<typeof useTranslations<'account.returns'>>;

interface ReturnDetailProps {
  returnId: string;
  initialReturn?: Return | null;
}

function renderReturnReasonLabel(t: ReturnsTranslations, code: string): string {
  const translationKey = getReturnReasonTranslationKey(code);
  if (translationKey) {
    return t(translationKey);
  }

  return getReturnReasonLabel(code);
}

function getItemRefund(item: ExtendedReturnItem) {
  if (item.calculatedPrice?.finalPrice?.grossValue !== undefined) {
    return {
      value: item.calculatedPrice.finalPrice.grossValue,
      currency: item.calculatedPrice.finalPrice.currency ?? item.total?.currency ?? item.unitPrice?.currency,
    };
  }
  if (item.grossUnitPrice?.value !== undefined && item.grossUnitPrice?.currency) {
    return { value: item.grossUnitPrice.value * item.quantity, currency: item.grossUnitPrice.currency };
  }
  if (item.unitPrice?.value !== undefined && item.unitPrice?.currency) {
    return { value: item.unitPrice.value * item.quantity, currency: item.unitPrice.currency };
  }
  if (item.total?.value !== undefined && item.total?.currency) {
    return { value: item.total.value, currency: item.total.currency };
  }
  return { value: undefined, currency: undefined };
}

function getItemUnitPrice(item: ExtendedReturnItem) {
  return {
    grossValue: item.calculatedUnitPrice?.grossValue ?? item.grossUnitPrice?.value ?? item.unitPrice?.value,
    currency:
      item.calculatedUnitPrice?.currency ??
      item.grossUnitPrice?.currency ??
      item.netPrice?.currency ??
      item.unitPrice?.currency,
  };
}

function ReturnItemRow({ item, locale, t }: { item: ExtendedReturnItem; locale: string; t: ReturnsTranslations }) {
  const refund = getItemRefund(item);
  const unitPrice = getItemUnitPrice(item);
  const imageUrl = item.images?.[0];

  return (
    <TableRow className="hover:bg-surface-image-background">
      <TableCell className="w-[88px] py-4 pl-6 pr-3 align-middle sm:pl-8">
        <div className="flex h-[52px] w-20 items-center justify-center border border-border-primary bg-surface-image-background">
          {imageUrl ? (
            <Image src={imageUrl} alt={item.name} width={80} height={52} className="h-full w-full object-contain" />
          ) : (
            <Package className="h-5 w-5 text-icon-secondary opacity-40" aria-hidden="true" />
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle">
        {item.vendorName ? <p className="text-xs text-text-placeholders">{item.vendorName}</p> : null}
        {item.productId ? (
          <Link href={`/product/${item.productId}`} className="text-sm font-bold text-text-headings hover:underline">
            {item.name}
          </Link>
        ) : (
          <p className="text-sm font-bold text-text-headings">{item.name}</p>
        )}
        {item.itemNumber ? (
          <p className="mt-0.5 text-xs text-text-placeholders">
            {t('itemNumberLabel')}: {item.itemNumber}
          </p>
        ) : null}
        {item.reason?.code ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="warning" rounded="default">
              {renderReturnReasonLabel(t, item.reason.code)}
            </Badge>
          </div>
        ) : null}
        {item.reason?.details ? <p className="mt-1 text-xs text-text-placeholders">{item.reason.details}</p> : null}
      </TableCell>
      <TableCell className="px-4 py-4 text-right align-middle text-sm font-medium tabular-nums">
        {formatReturnCurrency(unitPrice.grossValue, unitPrice.currency, locale)}
      </TableCell>
      <TableCell className="px-4 py-4 text-center align-middle text-sm font-medium tabular-nums">
        {item.quantity}
      </TableCell>
      <TableCell className="py-4 pl-4 pr-6 text-right align-middle text-sm font-bold tabular-nums sm:pr-8">
        {formatReturnCurrency(refund.value, refund.currency, locale)}
      </TableCell>
    </TableRow>
  );
}

export function ReturnDetail({ returnId, initialReturn }: ReturnDetailProps) {
  const t = useTranslations('account.returns');
  const locale = useLocale();
  const { returnItem: apiReturnItem, loading, error, refreshReturn } = useReturn(returnId, initialReturn);

  const returnItem: ExtendedReturn | null = (apiReturnItem as ExtendedReturn) || null;

  if (loading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !returnItem) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error?.message || t('returnNotFound')}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refreshReturn()}>{t('tryAgain')}</Button>
          <Link href="/account/returns" passHref>
            <Button variant="secondary">{t('backToList')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const allItems: ExtendedReturnItem[] = returnItem.orders.flatMap((order) => order.items);
  const generalReasonCode = returnItem.reason?.code;

  const totalGrossValue = returnItem.calculatedPrice?.finalPrice?.grossValue;
  const totalNetValue = returnItem.calculatedPrice?.finalPrice?.netValue ?? returnItem.total?.value;
  const totalCurrency = returnItem.calculatedPrice?.finalPrice?.currency ?? returnItem.total?.currency;

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={t('returnDetails')}
        title={returnItem.id}
        aside={
          <AccountDetailStatus label={t('statusLabel')}>
            <ReturnStatusBadge status={returnItem.status} isExpired={returnItem.isExpired} />
          </AccountDetailStatus>
        }
      />

      <div className="border-b border-border-primary">
        <AccountSpecTable>
          <SpecRow
            left={{ label: t('returnDate'), value: formatReturnDate(returnItem.createdAt, locale) }}
            right={{ label: t('orderNumber'), value: getFirstOrderId(returnItem) }}
          />
          <SpecRow
            left={{ label: t('email'), value: getRequestorEmail(returnItem) }}
            right={
              generalReasonCode
                ? { label: t('reason'), value: renderReturnReasonLabel(t, generalReasonCode) }
                : undefined
            }
          />
        </AccountSpecTable>
      </div>

      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('returnedProducts')}</AccountSectionBar>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[88px] py-4 pl-6 pr-3 font-bold sm:pl-8">{t('product')}</TableHead>
              <TableHead className="px-4 py-4 font-bold" />
              <TableHead className="w-36 px-4 py-4 text-right font-bold">{t('price')}</TableHead>
              <TableHead className="w-24 px-4 py-4 text-center font-bold">{t('quantity')}</TableHead>
              <TableHead className="w-40 py-4 pl-4 pr-6 text-right font-bold sm:pr-8">{t('refundAmount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.map((item) => (
              <ReturnItemRow key={item.id} item={item} locale={locale} t={t} />
            ))}
          </TableBody>
        </Table>

        <div className="border-t border-border-primary px-6 py-6 sm:px-8">
          <table className="ml-auto w-full max-w-sm border-collapse text-sm">
            <tbody>
              <tr className="border-t border-border-primary">
                <td className="pt-3 pr-8 font-bold text-text-headings">{t('totalReturnValue')}</td>
                <td className="pt-3 text-right font-bold tabular-nums text-text-headings">
                  {totalGrossValue !== undefined ? formatReturnCurrency(totalGrossValue, totalCurrency, locale) : '-'}
                </td>
              </tr>
              {totalNetValue !== undefined ? (
                <tr>
                  <td className="py-1 pr-8 text-text-placeholders">{t('net')}</td>
                  <td className="py-1 text-right tabular-nums text-text-placeholders">
                    {formatReturnCurrency(totalNetValue, totalCurrency, locale)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AccountDetailContainer>
  );
}
