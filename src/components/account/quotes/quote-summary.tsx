'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  AccountSpecTable,
  type SpecEntry,
  SpecFullWidthRow,
  SpecPairRows,
  SpecRow,
  SpecSection,
} from '@/components/account/shared/account-spec-table';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import UiLink from '@/components/ui/link';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
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
  relatedApprovalId?: string | null;
  relatedApprovalHref?: string;
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

export function QuoteSummary({ quote, relatedApprovalId, relatedApprovalHref }: QuoteSummaryProps) {
  const t = useTranslations('account.quoteDetails');
  const tList = useTranslations('account.quotesList');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const currency = quote.currency || getPublicDefaultCurrency();
  const itemCount = quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0;
  const fmt = (amount: number) => formatCurrency(amount, currency, locale);
  const shippingMethod = quote.shippingMethod?.trim() || '';
  const addressLines = quote.shippingAddress ? shippingAddressLines(quote.shippingAddress) : [];
  const baseBreakdown = resolveQuoteBasePriceBreakdown(quote);
  const quotedBreakdown = resolveQuoteQuotedPriceBreakdown(quote);

  const priceEntries = (breakdown: QuotePriceCardBreakdown, totalLabel: string, showDiscount: boolean) => {
    const taxLine = {
      taxRate: breakdown.taxRate,
      taxAmount: breakdown.tax,
      netAmount: breakdown.netValueOfGoods,
    };
    const shippingTaxLine = {
      taxRate: breakdown.shippingTaxRate,
      taxAmount: breakdown.shippingTax,
      netAmount: breakdown.shippingFee,
    };
    const entries: SpecEntry[] = [{ key: 'net', label: t('netValue'), value: fmt(breakdown.netValueOfGoods) }];
    if (showDiscount && breakdown.discountAmount > 0) {
      entries.push({ key: 'discount', label: t('discount'), value: `−${fmt(breakdown.discountAmount)}` });
    }
    if (shouldDisplayTaxLine(taxLine)) {
      entries.push({
        key: 'tax',
        label: `${tCommon('tax')}${detailTaxRateSuffix(taxLine)}`,
        value: fmt(breakdown.tax),
      });
    }
    entries.push({
      key: 'shipping',
      label: t('shippingFee'),
      value: formatShippingFeeDisplay(breakdown.shippingFee, fmt, t('free')),
    });
    if (breakdown.showShippingTax && shouldDisplayTaxLine(shippingTaxLine)) {
      entries.push({
        key: 'shippingTax',
        label: `${t('shippingVat')}${detailTaxRateSuffix(shippingTaxLine)}`,
        value: fmt(breakdown.shippingTax),
      });
    }
    entries.push({
      key: 'total',
      label: totalLabel,
      value: <span className="font-bold text-text-headings">{fmt(breakdown.total)}</span>,
    });
    return entries;
  };

  return (
    <AccountSpecTable>
      <SpecSection title={t('details')}>
        <SpecRow
          left={{ label: t('quotationDate'), value: formatDate(quote.submittedDate, locale) }}
          right={{ label: t('requestedBy'), value: quote.customerName || quote.customerId || '-' }}
        />
        <SpecRow
          left={{ label: t('numberOfProducts'), value: itemCount }}
          right={{ label: tList('quoteReference'), value: quote.reference || '-' }}
        />
        {quote.orderId ? (
          <SpecRow
            left={{
              label: t('relatedOrder'),
              value: (
                <UiLink
                  href={`/account/orders/${quote.orderId}`}
                  type="Link"
                  variant="primary"
                  size="m"
                  data-testid="quote-relatedOrder"
                >
                  #{quote.orderId}
                </UiLink>
              ),
            }}
          />
        ) : null}
        {relatedApprovalId ? (
          <SpecRow
            left={{
              label: t('relatedApproval'),
              value: relatedApprovalHref ? (
                <UiLink
                  href={relatedApprovalHref}
                  type="Link"
                  variant="primary"
                  size="m"
                  data-testid="quote-relatedApproval"
                >
                  #{relatedApprovalId}
                </UiLink>
              ) : (
                <span data-testid="quote-relatedApproval">#{relatedApprovalId}</span>
              ),
            }}
          />
        ) : null}
      </SpecSection>

      <SpecSection title={t('basePrice')}>
        <SpecPairRows entries={priceEntries(baseBreakdown, t('baseTotal'), true)} />
      </SpecSection>

      <SpecSection title={t('quotedPrice')}>
        <SpecPairRows entries={priceEntries(quotedBreakdown, t('quotedTotal'), false)} />
      </SpecSection>

      <SpecSection title={t('shipping')}>
        <SpecRow left={{ label: t('shippingMethod'), value: shippingMethod || '-' }} />
        <SpecFullWidthRow label={t('shippingAddress')}>
          {addressLines.length > 0 ? (
            <div className="leading-relaxed" data-testid="quote-summary-shipping-address">
              {addressLines.map((line, index) => (
                <span key={`${index}-${line}`}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-placeholders">-</span>
          )}
        </SpecFullWidthRow>
      </SpecSection>
    </AccountSpecTable>
  );
}
