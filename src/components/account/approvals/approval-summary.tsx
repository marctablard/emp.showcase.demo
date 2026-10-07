'use client';

import { useLocale, useTranslations } from 'next-intl';
import { resolveApprovalCartGoods } from '@/components/account/approvals/approval-cart-goods';
import {
  resolveCartOrderOverviewShippingTax,
  resolveCartOrderOverviewTotalGross,
} from '@/components/account/approvals/approval-cart-overview';
import { resolveApprovalNetAmount } from '@/components/account/approvals/approval-net-amount';
import {
  type ApprovalPriceCardBreakdown,
  resolveApprovalBasePriceBreakdown,
  resolveApprovalDisplayTaxRate,
  resolveApprovalQuotedPriceBreakdown,
} from '@/components/account/approvals/approval-price-summary';
import {
  AccountSpecTable,
  type SpecEntry,
  SpecFullWidthRow,
  SpecNoteRow,
  SpecPairRows,
  SpecRow,
  SpecSection,
} from '@/components/account/shared/account-spec-table';
import { detailTaxRateSuffix, shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { formatShippingFeeDisplay } from '@/components/account/shared/format-shipping-fee';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatCurrency } from '@/lib/utils';
import type { Approval, ApprovalResourceItem } from '@/platform/services/model/approval';

interface ApprovalSummaryProps {
  approval: Approval;
}

export function ApprovalSummary({ approval }: ApprovalSummaryProps) {
  const t = useTranslations('orders.Approval');
  const tOrders = useTranslations('orders');
  const tCommon = useTranslations('common');
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
  const goods = resolveApprovalCartGoods(approval, valueOfGoods);
  const vat = goods.vat;
  const goodsNet = goods.net;
  const taxLine = {
    taxAmount: vat,
    netAmount: goodsNet,
    taxRate: resolveApprovalDisplayTaxRate(approval),
  };
  const showTaxLine = shouldDisplayTaxLine(taxLine);
  const totalGross = resolveCartOrderOverviewTotalGross(approval);
  const { shippingTaxEstimated, showShippingTaxEstimated } = resolveCartOrderOverviewShippingTax({
    totalGross,
    shippingFee: shippingCost,
    goodsNet,
    goodsVat: vat,
  });
  const shippingTaxLine = {
    taxRate: approval.details?.shipping?.taxRate,
    taxAmount: shippingTaxEstimated,
  };

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

    const name = [
      addr.contactName || addr.firstName || addr.name || addr.companyName,
      addr.contactName ? undefined : addr.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const street = [addr.street, addr.houseNumber || addr.streetNumber].filter(Boolean).join(' ').trim();
    const cityLine = [addr.postalCode || addr.zipCode, addr.city].filter(Boolean).join(' ').trim();
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

  const quotePriceEntries = (breakdown: ApprovalPriceCardBreakdown, totalLabel: string, showDiscount: boolean) => {
    const line = {
      taxRate: breakdown.taxRate,
      taxAmount: breakdown.tax,
      netAmount: breakdown.netValueOfGoods,
    };
    const entries: SpecEntry[] = [{ key: 'net', label: t('netValueOfGoods'), value: fmt(breakdown.netValueOfGoods) }];
    if (showDiscount && breakdown.discountAmount > 0) {
      entries.push({ key: 'discount', label: t('discount'), value: `−${fmt(breakdown.discountAmount)}` });
    }
    if (shouldDisplayTaxLine(line)) {
      entries.push({ key: 'tax', label: `${tCommon('tax')}${detailTaxRateSuffix(line)}`, value: fmt(breakdown.tax) });
    }
    entries.push({
      key: 'shipping',
      label: t('shippingFee'),
      value: formatShippingFeeDisplay(breakdown.shippingFee, fmt, t('free')),
    });
    if (breakdown.showShippingTax) {
      const shippingLine = {
        taxRate: breakdown.shippingTaxRate,
        taxAmount: breakdown.shippingTax,
        netAmount: breakdown.shippingFee,
      };
      entries.push({
        key: 'shippingTax',
        label: `${t('shippingVat')}${detailTaxRateSuffix(shippingLine)}`,
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

  if (isQuote && baseBreakdown && quotedBreakdown) {
    return (
      <AccountSpecTable>
        <SpecSection title={t('quoteDetails')}>
          <SpecRow
            left={{ label: t('quoteReference'), value: approval.resource.id }}
            right={{ label: t('numberOfProducts'), value: items.length }}
          />
        </SpecSection>
        <SpecSection title={t('basePrice')}>
          <SpecPairRows entries={quotePriceEntries(baseBreakdown, t('baseTotal'), true)} />
        </SpecSection>
        <SpecSection title={t('quotedPrice')}>
          <SpecPairRows entries={quotePriceEntries(quotedBreakdown, t('quotedTotal'), false)} />
        </SpecSection>
      </AccountSpecTable>
    );
  }

  const overviewEntries: SpecEntry[] = [];
  if (goods.discounted) {
    overviewEntries.push({
      key: 'originalValueOfGoods',
      label: tOrders('originalValueOfGoods'),
      value: (
        <span className="line-through" data-testid="approval-originalValueOfGoods">
          {fmt(goods.originalNet)}
        </span>
      ),
    });
    if (typeof goods.savings === 'number') {
      overviewEntries.push({
        key: 'yourSavings',
        label: tOrders('yourSavings'),
        value: (
          <span className="font-bold" data-testid="approval-yourSavings">
            {formatCurrency(-Math.abs(goods.savings), currency, locale)}
          </span>
        ),
      });
    }
  }
  overviewEntries.push({
    key: 'netValueOfGoods',
    label: t('netValueOfGoods'),
    value: <span data-testid="approval-netValueOfGoods">{fmt(goods.discounted ? goods.net : valueOfGoods)}</span>,
  });
  if (showTaxLine) {
    overviewEntries.push({ key: 'tax', label: `${tCommon('tax')}${detailTaxRateSuffix(taxLine)}`, value: fmt(vat) });
  }
  if (shippingCost === 0) {
    overviewEntries.push({
      key: 'shippingFee',
      label: t('shippingFee'),
      value: (
        <span data-testid="approval-overview-shipping-fee">
          {formatShippingFeeDisplay(shippingCost, fmt, t('free'))}
        </span>
      ),
    });
  }
  overviewEntries.push({
    key: 'totalValueOfGoods',
    label: t('totalValueOfGoods'),
    value: (
      <span className="font-bold text-text-headings">{typeof totalGross === 'number' ? fmt(totalGross) : '-'}</span>
    ),
  });
  if (shippingCost > 0) {
    overviewEntries.push({
      key: 'shippingFee',
      label: t('shippingFeeEstimated'),
      value: <span data-testid="approval-overview-shipping-fee">{fmt(shippingCost)}</span>,
    });
    if (showShippingTaxEstimated) {
      overviewEntries.push({
        key: 'shippingTaxEstimated',
        label: `${t('shippingVatEstimated')}${detailTaxRateSuffix(shippingTaxLine)}`,
        value: <span data-testid="approval-overview-shipping-tax-estimated">{fmt(shippingTaxEstimated)}</span>,
      });
    }
  }

  return (
    <AccountSpecTable>
      <SpecSection title={t('orderOverview')}>
        <SpecPairRows entries={overviewEntries} />
      </SpecSection>

      <SpecSection title={t('shipping')}>
        <SpecRow
          left={{
            label: t('shippingMethod'),
            value: details?.shipping?.methodName || details?.shipping?.methodId || t('notProvided'),
          }}
        />
        <SpecFullWidthRow label={t('shippingAddress')}>{renderAddress(shippingAddress)}</SpecFullWidthRow>
      </SpecSection>

      <SpecSection title={t('payment')}>
        <SpecRow
          left={{
            label: t('paymentMethod'),
            value: payment?.code || payment?.provider || t('notProvided'),
          }}
        />
        <SpecFullWidthRow label={t('billingAddress')}>{renderAddress(billingAddress)}</SpecFullWidthRow>
      </SpecSection>

      <SpecNoteRow title={t('note')}>
        {approval.comment || <span className="text-text-placeholders">{t('noRequestorComment')}</span>}
      </SpecNoteRow>
    </AccountSpecTable>
  );
}
