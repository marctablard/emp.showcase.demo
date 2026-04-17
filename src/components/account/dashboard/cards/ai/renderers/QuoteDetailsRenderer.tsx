'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { QuoteDetailsData } from '../types';
import { formatDate, formatPrice, getQuoteStatusBadgeVariantForAi } from '../utils';
import type { UnifiedProductItem } from './ProductItem';
import { ProductItem } from './ProductItem';

interface QuoteDetailsRendererProps {
  data: QuoteDetailsData;
}

export const QuoteDetailsRenderer: React.FC<QuoteDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const fallbackCurrency = 'USD';

  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3 text-base">{data.message}</div>}

      <div className="bg-surface-primary rounded-xl border border-border-primary shadow-sm overflow-hidden">
        <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-4 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <a
                  href={`/account/quotes/${data.quoteId}`}
                  className="text-text-on-action hover:text-text-on-action/80 font-semibold text-xl underline"
                >
                  {data.reference || `#${data.quoteId}`}
                </a>
                <Badge variant={getQuoteStatusBadgeVariantForAi(data.status)} size="status">
                  {data.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-text-on-action/90">
                <div className="flex items-center space-x-2">
                  <span>📅</span>
                  <span className="font-medium">
                    {t('submitted')} {formatDate(data.submittedDate)}
                  </span>
                </div>
                {data.validTo && (
                  <div className="flex items-center space-x-2">
                    <span>⏰</span>
                    <span className="font-medium">
                      {t('validUntil')} {formatDate(data.validTo)}
                    </span>
                  </div>
                )}
                {data.customerName && (
                  <div className="flex items-center space-x-2">
                    <span>👤</span>
                    <span className="font-medium">
                      {t('customer')} {data.customerName}
                    </span>
                  </div>
                )}
                {data.approverName && (
                  <div className="flex items-center space-x-2">
                    <span>✅</span>
                    <span className="font-medium">
                      {t('approver')} {data.approverName}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-text-on-action">
                {formatPrice(data.totalGross || 0, data.currency, fallbackCurrency)}
              </div>
              {data.totalNet && (
                <div className="text-sm text-text-on-action/90">
                  {t('net')} {formatPrice(data.totalNet, data.currency, fallbackCurrency)}
                  {data.totalVat && ` | ${t('tax')} ${formatPrice(data.totalVat, data.currency, fallbackCurrency)}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {data.items && data.items.length > 0 && (
          <div className="p-3 bg-surface-primary">
            <div className="text-sm font-semibold text-text-body mb-2">{t('quoteItems')}</div>
            <div className="bg-surface-primary rounded-lg border border-border-primary overflow-hidden">
              {data.items.map((item: any, itemIndex: number) => {
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
                    data.currency ||
                    fallbackCurrency,
                  unitPrice: item.unitPrice
                    ? {
                        value: item.unitPrice.value || item.unitPrice,
                        currency: item.unitPrice.currency || data.currency || fallbackCurrency,
                        net: item.unitPrice.net,
                        gross: item.unitPrice.gross || item.unitPrice.value || item.unitPrice,
                      }
                    : undefined,
                  totalPrice: item.totalPrice
                    ? {
                        value: item.totalPrice.value || item.totalPrice,
                        currency: item.totalPrice.currency || data.currency || fallbackCurrency,
                        net: item.totalPrice.net,
                        gross: item.totalPrice.gross || item.totalPrice.value || item.totalPrice,
                      }
                    : undefined,
                };
                return (
                  <div key={itemIndex}>
                    <div className="p-4">
                      <ProductItem
                        item={unifiedItem}
                        currency={data.currency || fallbackCurrency}
                        showQuantity={true}
                        showUnitPrice={true}
                        showTotalPrice={true}
                        showNetGross={false}
                      />
                    </div>
                    {data.items && itemIndex < data.items.length - 1 && (
                      <div className="border-t border-border-primary"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(data.shippingAddress || data.shippingCost || data.shippingMethod) && (
          <div className="p-4 border-t border-border-primary">
            <div className="text-sm font-semibold text-text-body mb-3">{t('shippingInformation')}</div>
            {data.shippingAddress && (
              <div className="mb-3 text-sm text-text-body">
                <div className="font-medium mb-1">{t('shippingAddress')}</div>
                <div>{data.shippingAddress.name}</div>
                <div>{data.shippingAddress.addressLine1}</div>
                {data.shippingAddress.addressLine2 && <div>{data.shippingAddress.addressLine2}</div>}
                <div>
                  {data.shippingAddress.city}, {data.shippingAddress.state} {data.shippingAddress.postalCode}
                </div>
                <div>{data.shippingAddress.country}</div>
              </div>
            )}
            <div className="flex justify-between items-center">
              {data.shippingMethod && (
                <div className="text-sm text-text-body">
                  <span className="font-medium">{t('method')}</span> {data.shippingMethod}
                </div>
              )}
              {data.shippingCost !== undefined && (
                <div className="text-sm font-semibold text-text-headings">
                  {t('shipping')} {formatPrice(data.shippingCost, data.currency, fallbackCurrency)}
                </div>
              )}
            </div>
          </div>
        )}

        {(data.userComment || data.employeeComment) && (
          <div className="p-4 border-t border-border-primary bg-surface-image-background">
            <div className="text-sm font-semibold text-text-body mb-2">{t('comments')}</div>
            {data.userComment && (
              <div className="mb-2 text-sm text-text-body">
                <span className="font-medium">{t('yourComment')}</span> {data.userComment}
              </div>
            )}
            {data.employeeComment && (
              <div className="text-sm text-text-body">
                <span className="font-medium">{t('employeeComment')}</span> {data.employeeComment}
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-border-primary">
          <a
            href={`/account/quotes/${data.quoteId}`}
            className="block w-full text-center px-4 py-2 bg-surface-action text-text-on-action font-semibold rounded-lg hover:bg-surface-action-hover transition-colors"
          >
            {t('viewFullQuoteDetails')}
          </a>
        </div>
      </div>
    </div>
  );
};
