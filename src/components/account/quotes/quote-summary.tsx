'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { List, ReceiptText, Truck } from 'lucide-react';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import { H5 } from '@/components/ui/h';
import { SummaryCard, SummaryField } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatCurrency } from '@/lib/utils';
import type { CheckoutAddress } from '@/platform/services/model/checkout';
import type { Quote } from '@/platform/services/model/quote';
import {
  type QuotePriceCardBreakdown,
  resolveQuoteBasePriceBreakdown,
  resolveQuoteQuotedPriceBreakdown,
} from './quote-price-summary';

interface QuoteSummaryProps {
  quote: Quote;
}

/** Non-empty trimmed address segment; drops blank / literal "undefined" tokens. */
function addressPart(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  // Mapper used to concat optional lines with `+`, baking the JS string "undefined" into street.
  const cleaned = trimmed
    .split(/\s+/)
    .filter((token) => token !== 'undefined')
    .join(' ')
    .trim();
  return cleaned || undefined;
}

/**
 * Build shipping address lines for Quote summary (finding 13).
 * Omits missing parts so JS undefined never leaks into the rendered string.
 */
function shippingAddressLines(address: CheckoutAddress): string[] {
  const streetLine = [addressPart(address.street), addressPart(address.streetNumber)]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  const cityLine = [addressPart(address.zipCode), addressPart(address.city)]
    .filter((part): part is string => Boolean(part))
    .join(' ');

  return [
    addressPart(address.contactName),
    streetLine || undefined,
    cityLine || undefined,
    addressPart(address.country),
  ].filter((line): line is string => Boolean(line));
}

export const QuoteSummary: React.FC<QuoteSummaryProps> = ({ quote }) => {
  const t = useTranslations('account.quoteDetails');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const currency = quote.currency || getPublicDefaultCurrency();
  const fmt = (amount: number) => formatCurrency(amount, currency, locale);
  const shippingMethod = quote.shippingMethod?.trim() || '';
  const addressLines = shippingAddressLines(quote.shippingAddress);
  const baseBreakdown = resolveQuoteBasePriceBreakdown(quote);
  const quotedBreakdown = resolveQuoteQuotedPriceBreakdown(quote);

  const renderPriceRows = (breakdown: QuotePriceCardBreakdown, totalLabel: string, showDiscount: boolean) => {
    const taxLine = {
      taxRate: breakdown.taxRate,
      taxAmount: breakdown.tax,
      netAmount: breakdown.netValueOfGoods,
    };
    const showTaxLine = shouldDisplayTaxLine(taxLine);
    const shippingTaxLine = {
      taxAmount: breakdown.shippingTax,
      netAmount: breakdown.shippingFee,
    };
    const showShippingTax = breakdown.showShippingTax && shouldDisplayTaxLine(shippingTaxLine);

    return (
      <div className="space-y-4 text-base font-body text-text-body">
        <div className="flex justify-between gap-4">
          <span>{t('netValue')}</span>
          <span>{fmt(breakdown.netValueOfGoods)}</span>
        </div>
        {showDiscount && breakdown.discountAmount > 0 ? (
          <div className="flex justify-between gap-4">
            <span>{t('discount')}</span>
            <span>−{fmt(breakdown.discountAmount)}</span>
          </div>
        ) : null}
        {showTaxLine && (
          <div className="flex justify-between gap-4">
            <span>
              {tCommon('tax')}
              {detailTaxRateSuffix(taxLine)}
            </span>
            <span>{fmt(breakdown.tax)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span>{t('shippingFee')}</span>
          <span>{formatShippingFeeDisplay(breakdown.shippingFee, fmt, t('free'))}</span>
        </div>
        {showShippingTax ? (
          <div className="flex justify-between gap-4">
            <span>
              {t('shippingVat')}
              {detailTaxRateSuffix(shippingTaxLine)}
            </span>
            <span>{fmt(breakdown.shippingTax)}</span>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-4 pt-2">
          <H5>{totalLabel}</H5>
          <H5>{fmt(breakdown.total)}</H5>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">
      {/* Base Price Card */}
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('basePrice')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="p-0"
          icon={<List className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          {renderPriceRows(baseBreakdown, t('baseTotal'), true)}
        </SummaryCard>
      </div>

      {/* Shipping Card */}
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('shipping')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<Truck className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryField label={t('shippingMethod')}>{shippingMethod || '—'}</SummaryField>
          <SummaryField label={t('shippingAddress')}>
            {addressLines.map((line, index) => (
              <React.Fragment key={`${index}-${line}`}>
                {index > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
          </SummaryField>
        </SummaryCard>
      </div>

      {/* Quoted Price Card — success surface without dual blue+green border (Figma 11936-178681) */}
      <div className="rounded-md bg-surface-success p-6 shadow-sm" data-testid="quote-summary-quoted-price">
        <SummaryCard
          heading={t('quotedPrice')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="p-0"
          icon={<ReceiptText className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          {renderPriceRows(quotedBreakdown, t('quotedTotal'), false)}
        </SummaryCard>
      </div>
    </div>
  );
};
