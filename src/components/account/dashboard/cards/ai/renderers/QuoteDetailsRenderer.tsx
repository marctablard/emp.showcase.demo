'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { mapAiQuoteItems } from '@/lib/common/ai-quote-items';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { getQuoteStatusDisplayLabel } from '@/lib/common/quote-status-message-keys';
import type { QuoteDetailsData } from '../types';
import { formatDate, formatPrice, getQuoteStatusBadgeVariantForAi } from '../utils';
import { mapAiQuote } from '../utils/map-ai-quote';
import type { UnifiedProductItem } from './ProductItem';
import { ProductItem } from './ProductItem';
import { widgetOrSkeleton } from './WidgetSkeleton';

interface QuoteDetailsRendererProps {
  data: QuoteDetailsData | Record<string, unknown>;
}

export const QuoteDetailsRenderer: React.FC<QuoteDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tCommon = useTranslations('common');
  const tQuoteStatus = useTranslations('account.quoteStatus');
  const locale = useLocale();
  const fallbackCurrency = getPublicDefaultCurrency();
  const quote = mapAiQuote(data, locale);
  const details = data as QuoteDetailsData;
  const items = mapAiQuoteItems(details.items, locale);

  if (!quote.quoteId && !quote.reference) {
    return widgetOrSkeleton(null, null);
  }

  const currency = quote.currency || details.currency;

  return (
    <div className="space-y-4">
      {details.message && <div className="text-text-body mb-3 text-base">{details.message}</div>}

      <div className="bg-surface-primary rounded-xl border border-border-primary shadow-sm overflow-hidden">
        <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-4 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <a
                  href={`/account/quotes/${quote.quoteId}`}
                  className="text-text-on-action hover:text-text-on-action/80 font-semibold text-xl underline"
                >
                  {quote.reference || `#${quote.quoteId}`}
                </a>
                <Badge variant={getQuoteStatusBadgeVariantForAi(quote.status)} size="status">
                  {getQuoteStatusDisplayLabel(quote.status, tQuoteStatus)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-text-on-action/90">
                <div className="flex items-center space-x-2">
                  <span>📅</span>
                  <span className="font-medium">
                    {t('submitted')} {formatDate(quote.submittedDate)}
                  </span>
                </div>
                {quote.validTo && (
                  <div className="flex items-center space-x-2">
                    <span>⏰</span>
                    <span className="font-medium">
                      {t('validUntil')} {formatDate(quote.validTo)}
                    </span>
                  </div>
                )}
                {quote.customerName && (
                  <div className="flex items-center space-x-2">
                    <span>👤</span>
                    <span className="font-medium">
                      {t('customer')} {quote.customerName}
                    </span>
                  </div>
                )}
                {details.approverName && (
                  <div className="flex items-center space-x-2">
                    <span>✅</span>
                    <span className="font-medium">
                      {t('approver')} {details.approverName}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-text-on-action">
                {formatPrice(quote.totalGross || 0, currency, fallbackCurrency)}
              </div>
              {quote.totalNet && (
                <div className="text-sm text-text-on-action/90">
                  {t('net')} {formatPrice(quote.totalNet, currency, fallbackCurrency)}
                  {quote.totalVat && ` | ${tCommon('tax')} ${formatPrice(quote.totalVat, currency, fallbackCurrency)}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="p-3 bg-surface-primary">
            <div className="text-sm font-semibold text-text-body mb-2">{t('quoteItems')}</div>
            <div className="bg-surface-primary rounded-lg border border-border-primary overflow-hidden">
              {items.map((item, itemIndex) => {
                const unifiedItem: UnifiedProductItem = {
                  productId: item.productId,
                  name: item.name,
                  image: item.image,
                  description: item.description,
                  quantity: item.quantity,
                  price: item.price,
                  currency:
                    item.currency ||
                    item.unitPrice?.currency ||
                    item.totalPrice?.currency ||
                    currency ||
                    fallbackCurrency,
                  unitPrice: item.unitPrice
                    ? {
                        value: item.unitPrice.value || item.unitPrice.gross,
                        currency: item.unitPrice.currency || currency || fallbackCurrency,
                        net: item.unitPrice.net,
                        gross: item.unitPrice.gross || item.unitPrice.value,
                      }
                    : undefined,
                  totalPrice: item.totalPrice
                    ? {
                        value: item.totalPrice.value || item.totalPrice.gross,
                        currency: item.totalPrice.currency || currency || fallbackCurrency,
                        net: item.totalPrice.net,
                        gross: item.totalPrice.gross || item.totalPrice.value,
                      }
                    : undefined,
                };
                return (
                  <div key={itemIndex}>
                    <div className="p-4">
                      <ProductItem
                        item={unifiedItem}
                        currency={currency || fallbackCurrency}
                        showQuantity={true}
                        showUnitPrice={true}
                        showTotalPrice={true}
                        showNetGross={false}
                      />
                    </div>
                    {itemIndex < items.length - 1 && <div className="border-t border-border-primary"></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(details.shippingAddress || details.shippingCost || details.shippingMethod) && (
          <div className="p-4 border-t border-border-primary">
            <div className="text-sm font-semibold text-text-body mb-3">{t('shippingInformation')}</div>
            {details.shippingAddress && (
              <div className="mb-3 text-sm text-text-body">
                <div className="font-medium mb-1">{t('shippingAddress')}</div>
                <div>{details.shippingAddress.name}</div>
                <div>{details.shippingAddress.addressLine1}</div>
                {details.shippingAddress.addressLine2 && <div>{details.shippingAddress.addressLine2}</div>}
                <div>
                  {details.shippingAddress.city}, {details.shippingAddress.state} {details.shippingAddress.postalCode}
                </div>
                <div>{details.shippingAddress.country}</div>
              </div>
            )}
            <div className="flex justify-between items-center">
              {details.shippingMethod && (
                <div className="text-sm text-text-body">
                  <span className="font-medium">{t('method')}</span> {details.shippingMethod}
                </div>
              )}
              {details.shippingCost !== undefined && (
                <div className="text-sm font-semibold text-text-headings">
                  {t('shipping')} {formatPrice(details.shippingCost, currency, fallbackCurrency)}
                </div>
              )}
            </div>
          </div>
        )}

        {(details.userComment || details.employeeComment) && (
          <div className="p-4 border-t border-border-primary bg-surface-image-background">
            <div className="text-sm font-semibold text-text-body mb-2">{t('comments')}</div>
            {details.userComment && (
              <div className="mb-2 text-sm text-text-body">
                <span className="font-medium">{t('yourComment')}</span> {details.userComment}
              </div>
            )}
            {details.employeeComment && (
              <div className="text-sm text-text-body">
                <span className="font-medium">{t('employeeComment')}</span> {details.employeeComment}
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-border-primary">
          <a
            href={`/account/quotes/${quote.quoteId}`}
            className="block w-full text-center px-4 py-2 bg-surface-action text-text-on-action font-semibold rounded-lg hover:bg-surface-action-hover transition-colors"
          >
            {t('viewFullQuoteDetails')}
          </a>
        </div>
      </div>
    </div>
  );
};
