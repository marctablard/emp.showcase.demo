'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, List, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { resolveApprovalNetAmount } from '@/components/account/approvals/approval-net-amount';
import {
  type ApprovalPriceCardBreakdown,
  resolveApprovalBasePriceBreakdown,
  resolveApprovalQuotedPriceBreakdown,
} from '@/components/account/approvals/approval-price-summary';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import { H5 } from '@/components/ui/h';
import { SummaryCard, SummaryField } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatCurrency } from '@/lib/utils';
import type { Approval, ApprovalResourceItem } from '@/platform/services/model/approval';

interface ApprovalSummaryProps {
  approval: Approval;
}

export const ApprovalSummary: React.FC<ApprovalSummaryProps> = ({ approval }) => {
  const t = useTranslations('orders.Approval');
  const locale = useLocale();

  const details = approval.details;
  const items = approval.resource.items || [];
  const netTotal = resolveApprovalNetAmount(approval);
  const currency =
    details?.currency ||
    netTotal?.currency ||
    approval.resource.totalPrice?.currency ||
    approval.resource.subTotalPrice?.currency ||
    getPublicDefaultCurrency();

  // CART overview: prefer mapped net line values; fall back to amount for legacy fixtures.
  const valueOfGoods = items.reduce((sum: number, it: ApprovalResourceItem) => {
    const price = it.itemPrice;
    if (typeof price?.netValue === 'number') {
      return sum + price.netValue;
    }
    if (typeof price?.newUnitPrice === 'number') {
      return sum + price.newUnitPrice * (it.quantity || 1);
    }
    return sum + (price?.amount || 0);
  }, 0);
  const shippingCost = details?.shipping?.amount ?? 0;
  const vat = approval.resource.subtotalAggregate?.taxValue ?? 0;
  const taxLine = {
    taxAmount: vat,
    netAmount: valueOfGoods > 0 ? valueOfGoods : approval.resource.subtotalAggregate?.netValue,
  };
  const showTaxLine = shouldDisplayTaxLine(taxLine);
  // Finding 26: model-backed net only — never totalPrice.amount or invented goods+shipping+vat.
  const formattedNetTotal = netTotal ? formatCurrency(netTotal.amount, netTotal.currency, locale) : '-';

  const shippingAddress = details?.addresses?.find?.((a: any) => a?.type === 'SHIPPING') || details?.addresses?.[0];
  const billingAddress = details?.addresses?.find?.((a: any) => a?.type === 'BILLING') || details?.addresses?.[1];
  const payment = details?.paymentMethods?.[0];
  const isQuote = approval.resourceType === 'QUOTE';
  const baseBreakdown = isQuote ? resolveApprovalBasePriceBreakdown(approval) : null;
  const quotedBreakdown = isQuote ? resolveApprovalQuotedPriceBreakdown(approval) : null;

  const fmt = (amount: number) => formatCurrency(amount, currency, locale);

  // Body/md (text-base) — same as shipping/payment method values (Figma 11895-138610).
  // Skip blank lines (e.g. missing contact name) so the block does not start with an empty row.
  const renderAddress = (addr: any) => {
    if (!addr) {
      return <span className="text-text-placeholders">{t('notProvided')}</span>;
    }

    const name = [addr.firstName || addr.name || addr.companyName, addr.lastName].filter(Boolean).join(' ').trim();
    const street = [addr.street, addr.houseNumber].filter(Boolean).join(' ').trim();
    const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(' ').trim();
    let cityWithRegion = cityLine;
    if (addr.region) {
      cityWithRegion = cityLine ? `${cityLine}, ${addr.region}` : String(addr.region);
    }
    const lines = [name, street, cityWithRegion, addr.country].map((line) => String(line ?? '').trim()).filter(Boolean);

    if (lines.length === 0) {
      return <span className="text-text-placeholders">{t('notProvided')}</span>;
    }

    return (
      <div>
        {lines.map((line, index) => (
          <span key={`${index}-${line}`}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </div>
    );
  };

  const renderQuotePriceRows = (breakdown: ApprovalPriceCardBreakdown, totalLabel: string, showDiscount: boolean) => {
    const line = {
      taxRate: breakdown.taxRate,
      taxAmount: breakdown.tax,
      netAmount: breakdown.netValueOfGoods,
    };
    const showTax = shouldDisplayTaxLine(line);

    return (
      <div className="space-y-4 text-base font-body text-text-body">
        <div className="flex justify-between gap-4">
          <span>{t('netValueOfGoods')}</span>
          <span>{fmt(breakdown.netValueOfGoods)}</span>
        </div>
        {showDiscount && breakdown.discountAmount > 0 ? (
          <div className="flex justify-between gap-4">
            <span>{t('discount')}</span>
            <span>−{fmt(breakdown.discountAmount)}</span>
          </div>
        ) : null}
        {showTax && (
          <div className="flex justify-between gap-4">
            <span>
              {t('tax')}
              {detailTaxRateSuffix(line)}
            </span>
            <span>{fmt(breakdown.tax)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span>{t('shippingFee')}</span>
          <span>{formatShippingFeeDisplay(breakdown.shippingFee, fmt, t('free'))}</span>
        </div>
        <div className="flex items-start justify-between gap-4 pt-2">
          <H5>{totalLabel}</H5>
          <H5>{fmt(breakdown.total)}</H5>
        </div>
      </div>
    );
  };

  if (isQuote && baseBreakdown && quotedBreakdown) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
          <SummaryCard
            heading={t('quoteDetails')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="space-y-4 p-0"
            icon={<NotebookPen className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            <SummaryField label={t('quoteReference')}>{approval.resource.id}</SummaryField>
            <SummaryField label={t('numberOfProducts')}>{items.length}</SummaryField>
          </SummaryCard>
        </div>

        <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
          <SummaryCard
            heading={t('basePrice')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="p-0"
            icon={<List className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            {renderQuotePriceRows(baseBreakdown, t('baseTotal'), true)}
          </SummaryCard>
        </div>

        {/* Quoted Price — success surface without dual blue+green border (match Quote Task 3.1) */}
        <div className="rounded-md bg-surface-success p-6 shadow-sm" data-testid="approval-summary-quoted-price">
          <SummaryCard
            heading={t('quotedPrice')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="p-0"
            icon={<ReceiptText className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            {renderQuotePriceRows(quotedBreakdown, t('quotedTotal'), false)}
          </SummaryCard>
        </div>
      </div>
    );
  }

  // CART: 1 col → 2×2 from sm (Figma 11895-138509 @1024) → single row of 4 from lg.
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('orderOverview')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<ReceiptText className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <div className="space-y-2 text-base font-body text-text-body">
            <div className="flex justify-between items-start gap-4 border-b border-border-primary pb-4">
              <span>{t('netValueOfGoods')}</span>
              <span className="text-right font-normal">{fmt(valueOfGoods)}</span>
            </div>
            {showTaxLine && (
              <div className="flex justify-between gap-4 pt-2">
                <span>
                  {t('tax')}
                  {detailTaxRateSuffix(taxLine)}
                </span>
                <span>{fmt(vat)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-2">
              <span>{t('shippingFee')}</span>
              <span>{formatShippingFeeDisplay(shippingCost, fmt, t('free'))}</span>
            </div>
            <div className="flex justify-between items-start gap-4 pt-2">
              <H5>{t('totalValue')}</H5>
              <H5>{formattedNetTotal}</H5>
            </div>
          </div>
        </SummaryCard>
      </div>

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('shipping')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<Truck className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryField label={t('shippingMethod')}>
            {details?.shipping?.methodName || details?.shipping?.methodId || t('notProvided')}
          </SummaryField>
          <SummaryField label={t('shippingAddress')}>{renderAddress(shippingAddress)}</SummaryField>
        </SummaryCard>
      </div>

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('payment')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<CreditCard className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryField label={t('paymentMethod')}>{payment?.name || payment?.type || t('notProvided')}</SummaryField>
          <SummaryField label={t('billingAddress')}>{renderAddress(billingAddress)}</SummaryField>
        </SummaryCard>
      </div>

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('other')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<NotebookPen className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryField label={t('note')} valueClassName={approval.comment ? undefined : 'text-text-placeholders'}>
            {approval.comment || t('noRequestorComment')}
          </SummaryField>
        </SummaryCard>
      </div>
    </div>
  );
};
