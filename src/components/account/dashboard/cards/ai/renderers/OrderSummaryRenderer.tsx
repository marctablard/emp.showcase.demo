'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
import type { OrderItemData, OrderSummaryData } from '../types';
import { extractPrice, formatPrice } from '../utils';
import {
  AiAddress,
  AiOrderStatus,
  AiProductLines,
  AiSpecGrid,
  type AiTotalRow,
  AiTotals,
  AiWidgetFooterLink,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
  orderItemToLine,
} from './ai-widget-kit';

interface OrderSummaryRendererProps {
  data: OrderSummaryData;
}

function itemsNetTotal(items: OrderItemData[]): number {
  return items.reduce((sum, item) => {
    if (item.totalPrice) {
      return sum + (extractPrice(item.totalPrice).net || 0);
    }
    if (item.unitPrice) {
      return sum + (extractPrice(item.unitPrice).net || 0) * (item.quantity || 1);
    }
    return sum;
  }, 0);
}

export const OrderSummaryRenderer: React.FC<OrderSummaryRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tCommon = useTranslations('common');
  const tOrders = useTranslations('orders');
  const locale = useLocale();

  const currency = data.currency || data.total?.currency || getPublicDefaultCurrency();
  const items = data.items ?? [];
  const total = extractPrice(data.total || {});
  const shipping = extractPrice(data.shipping || {});
  const subtotalNet = extractPrice(data.subtotal || {}).net || itemsNetTotal(items);

  const totals: AiTotalRow[] = [
    { key: 'subtotal', label: t('subtotal'), value: formatPrice(subtotalNet, currency) },
    ...(shipping.gross > 0 || shipping.net > 0
      ? [{ key: 'shipping', label: t('shipping'), value: formatPrice(shipping.net || shipping.gross, currency) }]
      : []),
    ...(total.tax > 0 ? [{ key: 'tax', label: tCommon('tax'), value: formatPrice(total.tax, currency) }] : []),
    { key: 'total', label: t('total'), value: formatPrice(total.gross || total.net, currency), emphasized: true },
  ];

  const hasAddresses = Boolean(data.shippingAddress || data.billingAddress);

  return (
    <AiWidgetFrame>
      <AiWidgetHeader
        eyebrow={t('orderSummary')}
        title={`#${data.orderId}`}
        aside={<AiOrderStatus status={data.status} />}
        meta={[
          data.date ? formatDate(data.date, locale) : null,
          data.totalItems ? `${data.totalItems} ${t('items')}` : null,
          data.siteCode ?? null,
        ]}
      />

      {items.length > 0 ? (
        <div className="border-b border-border-primary">
          <AiProductLines
            testIdPrefix={`aiOrderSummary-${data.orderId}`}
            lines={items.map((item) => orderItemToLine(item, currency))}
          />
        </div>
      ) : null}

      <AiWidgetSection>
        <AiTotals rows={totals} />
      </AiWidgetSection>

      {hasAddresses ? (
        <AiWidgetSection label={t('addresses')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.shippingAddress ? (
              <div>
                <p className="mb-1 text-xs text-text-placeholders">{t('shippingAddress')}</p>
                <AiAddress address={data.shippingAddress} />
              </div>
            ) : null}
            {data.billingAddress ? (
              <div>
                <p className="mb-1 text-xs text-text-placeholders">{t('billingAddress')}</p>
                <AiAddress address={data.billingAddress} />
              </div>
            ) : null}
          </div>
        </AiWidgetSection>
      ) : null}

      {data.payment ? (
        <AiWidgetSection label={t('paymentInformation')}>
          <AiSpecGrid
            entries={[
              { key: 'method', label: t('method'), value: data.payment.method },
              { key: 'status', label: tOrders('columns.status'), value: data.payment.status },
            ]}
          />
        </AiWidgetSection>
      ) : null}

      <AiWidgetFooterLink href={`/account/orders/${data.orderId}`} testId="aiOrderSummary-viewDetails">
        {t('viewFullOrderDetails')}
      </AiWidgetFooterLink>
    </AiWidgetFrame>
  );
};
