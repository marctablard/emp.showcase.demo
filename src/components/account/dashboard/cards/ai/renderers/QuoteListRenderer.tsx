'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { QuoteData, QuoteListData, QuotePreviewItemData } from '../types';
import { formatDate, formatPrice, getQuoteStatusBadgeVariantForAi, handleImageError } from '../utils';

interface QuoteListRendererProps {
  data: QuoteListData;
}

export const QuoteListRenderer: React.FC<QuoteListRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  return (
    <div className="space-y-4">
      {data.message && <div className="text-text-body mb-3 text-base">{data.message}</div>}
      {data.quotes &&
        data.quotes.map((quote: QuoteData, index: number) => (
          <div
            key={index}
            className="bg-surface-primary rounded-xl border border-border-primary shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-4 rounded-t-xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <a
                      href={`/account/quotes/${quote.quoteId}`}
                      className="text-text-on-action hover:text-text-on-action/80 font-semibold text-lg underline"
                    >
                      {quote.reference || `#${quote.quoteId}`}
                    </a>
                    <Badge variant={getQuoteStatusBadgeVariantForAi(quote.status)} size="status">
                      {quote.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-text-on-action/90">
                    <div className="flex items-center space-x-2">
                      <span>📅</span>
                      <span className="font-medium">{formatDate(quote.submittedDate)}</span>
                    </div>
                    {quote.validTo && (
                      <div className="flex items-center space-x-2">
                        <span>⏰</span>
                        <span className="font-medium">
                          {t('validUntil')} {formatDate(quote.validTo)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <span>📦</span>
                      <span className="font-medium">
                        {quote.itemCount || 0} {t('items')}
                      </span>
                    </div>
                    {quote.customerName && (
                      <div className="flex items-center space-x-2">
                        <span>👤</span>
                        <span className="font-medium">{quote.customerName}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-text-on-action">
                    {formatPrice(quote.totalGross || 0, quote.currency)}
                  </div>
                  {quote.totalNet && (
                    <div className="text-sm text-text-on-action/90">
                      {t('net')} {formatPrice(quote.totalNet, quote.currency)}
                      {quote.totalVat && ` | ${t('tax')} ${formatPrice(quote.totalVat, quote.currency)}`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {quote.previewItems && quote.previewItems.length > 0 && (
              <div className="p-3 bg-surface-primary">
                <div className="text-sm font-semibold text-text-body mb-2">{t('previewItems')}</div>
                <div className="flex flex-wrap gap-2">
                  {quote.previewItems.map((item: QuotePreviewItemData, itemIndex: number) => (
                    <div key={itemIndex} className="flex items-center space-x-2 text-sm text-text-body">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded"
                          onError={handleImageError}
                          unoptimized
                        />
                      )}
                      <span>
                        {item.name} (x{item.quantity})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

      {data.pagination && (
        <div className="flex justify-between items-center pt-4 border-t border-border-primary">
          <div className="text-sm text-text-body">
            {t('page', {
              page: data.pagination.page,
              totalPages: data.pagination.totalPages,
              totalItems: data.pagination.totalItems,
            })}
          </div>
        </div>
      )}
    </div>
  );
};
