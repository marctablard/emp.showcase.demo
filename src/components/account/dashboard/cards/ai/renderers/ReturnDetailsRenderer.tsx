'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import UiLink from '@/components/ui/link';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
import type { ReturnData, ReturnDetailsData, ReturnItemData } from '../types';
import { formatPrice, getReturnStatusBadgeVariantForAi } from '../utils';
import { WidgetSkeleton } from './WidgetSkeleton';
import {
  type AiProductLine,
  AiProductLines,
  AiSpecGrid,
  AiWidgetFooterLink,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
} from './ai-widget-kit';

interface ReturnDetailsRendererProps {
  data: ReturnDetailsData;
}

export function returnItemsOf(returnItem: ReturnData): ReturnItemData[] {
  return (returnItem.orders ?? []).flatMap((order) => order.items ?? []);
}

export function returnCurrencyOf(returnItem: ReturnData): string {
  return returnItem.currency || returnItem.total?.currency || getPublicDefaultCurrency();
}

export function AiReturnStatus({ returnItem }: Readonly<{ returnItem: ReturnData }>) {
  const t = useTranslations('account.AiHelper');
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1">
      {returnItem.approvalStatus ? (
        <Badge variant={getReturnStatusBadgeVariantForAi(returnItem.approvalStatus)} size="status">
          {returnItem.approvalStatus}
        </Badge>
      ) : null}
      {returnItem.received === undefined ? null : (
        <Badge variant={returnItem.received ? 'success' : 'warning'} size="status">
          {returnItem.received ? t('received') : t('notReceived')}
        </Badge>
      )}
    </span>
  );
}

function toLine(item: ReturnItemData, currency: string, reasonLabel: string): AiProductLine {
  const total = item.total?.value;
  const unit = item.unitPrice?.value ?? (total && item.quantity ? total / item.quantity : undefined);
  return {
    name: item.name,
    imageUrl: item.image,
    quantity: item.quantity,
    unitPrice: unit,
    totalPrice: total,
    currency: item.total?.currency || item.unitPrice?.currency || currency,
    note: item.reason?.code
      ? `${reasonLabel}: ${[item.reason.code, item.reason.details].filter(Boolean).join(' – ')}`
      : undefined,
  };
}

export const ReturnDetailsRenderer: React.FC<ReturnDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tReturns = useTranslations('account.returns');
  const locale = useLocale();
  const returnItem = data.return ?? (data.returns?.length === 1 ? data.returns[0] : undefined);

  if (!returnItem?.id) {
    return <WidgetSkeleton rows={1} />;
  }

  const currency = returnCurrencyOf(returnItem);
  const items = returnItemsOf(returnItem);
  const totalValue = returnItem.total?.value ?? 0;

  return (
    <div className="space-y-2">
      {data.message ? <p className="px-1 text-sm text-text-body">{data.message}</p> : null}
      <AiWidgetFrame>
        <AiWidgetHeader
          title={`#${returnItem.id}`}
          aside={<AiReturnStatus returnItem={returnItem} />}
          meta={[
            returnItem.expiryDate ? `${t('expiresOn')} ${formatDate(returnItem.expiryDate, locale)}` : null,
            items.length > 0 ? `${items.length} ${t('items')}` : null,
            totalValue > 0 ? formatPrice(totalValue, currency) : null,
          ]}
        />

        {returnItem.reason?.code ? (
          <AiWidgetSection>
            <AiSpecGrid
              entries={[
                {
                  key: 'reason',
                  label: t('reason'),
                  value: [returnItem.reason.code, returnItem.reason.details].filter(Boolean).join(' – '),
                },
              ]}
            />
          </AiWidgetSection>
        ) : null}

        {items.length > 0 ? (
          <div className="border-b border-border-primary">
            <AiProductLines
              testIdPrefix={`aiReturnDetails-${returnItem.id}`}
              lines={items.map((item) => toLine(item, currency, t('reason')))}
            />
          </div>
        ) : null}

        {returnItem.orders && returnItem.orders.length > 0 ? (
          <AiWidgetSection label={t('relatedOrders')}>
            <div className="flex flex-wrap gap-3">
              {returnItem.orders.map((order) => (
                <UiLink
                  key={order.id}
                  type="Link"
                  href={`/account/orders/${order.id}`}
                  variant="primary"
                  data-testid={`aiReturnDetails-order-${order.id}`}
                >
                  #{order.id}
                </UiLink>
              ))}
            </div>
          </AiWidgetSection>
        ) : null}

        <AiWidgetFooterLink href={`/account/returns/${returnItem.id}`} testId="aiReturnDetails-viewDetails">
          {tReturns('viewReturnAriaLabel', { id: returnItem.id })}
        </AiWidgetFooterLink>
      </AiWidgetFrame>
    </div>
  );
};
