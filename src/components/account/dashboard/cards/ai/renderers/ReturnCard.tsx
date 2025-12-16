'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { formatDate, formatPrice, getReturnStatusColor, handleImageError } from '../utils';

interface ReturnCardProps {
  returnItem: any;
}

const extractPriceValue = (priceObj: any): number => {
  if (!priceObj) return 0;
  return priceObj.value ?? 0;
};

export const ReturnCard: React.FC<ReturnCardProps> = ({ returnItem }) => {
  const t = useTranslations('account.AiHelper');

  if (!returnItem || (!returnItem.id && !returnItem.approvalStatus)) {
    return null;
  }

  const returnCurrency = returnItem.currency || returnItem.total?.currency || 'EUR';
  const totalValue = extractPriceValue(returnItem.total);

  const allItems: any[] = [];
  if (returnItem.orders && Array.isArray(returnItem.orders)) {
    returnItem.orders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        allItems.push(...order.items);
      }
    });
  }

  return (
    <div className="bg-surface-primary rounded-xl border border-border-primary shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-4 rounded-t-xl">
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-text-on-action font-semibold text-base">#{returnItem.id}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getReturnStatusColor(
                  returnItem.approvalStatus,
                )}`}
              >
                {returnItem.approvalStatus}
              </span>
              {returnItem.received !== undefined && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    returnItem.received
                      ? 'bg-surface-success text-text-success'
                      : 'bg-surface-warning text-text-warning'
                  }`}
                >
                  {returnItem.received ? t('received') : t('notReceived')}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-xs text-text-on-action/90">
              {returnItem.expiryDate && (
                <div className="flex items-center space-x-1">
                  <span>⏰</span>
                  <span>
                    {t('expiresOn')} {formatDate(returnItem.expiryDate)}
                  </span>
                </div>
              )}
              {allItems.length > 0 && (
                <div className="flex items-center space-x-1">
                  <span>📦</span>
                  <span>
                    {allItems.length} {t('items')}
                  </span>
                </div>
              )}
              {returnItem.reason && returnItem.reason.code && (
                <div className="flex items-center space-x-1">
                  <span>📋</span>
                  <span>{returnItem.reason.code}</span>
                </div>
              )}
            </div>
            {returnItem.reason && returnItem.reason.details && (
              <div className="mt-2 text-xs text-text-on-action/80">{returnItem.reason.details}</div>
            )}
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <div className="text-lg font-bold text-text-on-action">{formatPrice(totalValue, returnCurrency)}</div>
          </div>
        </div>
      </div>

      {allItems.length > 0 && (
        <div className="p-3 bg-surface-primary">
          <div className="text-sm font-semibold text-text-body mb-2">{t('previewItems')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm text-text-body">
            {allItems.map((item: any, itemIndex: number) => {
              const itemPriceValue = item.total
                ? extractPriceValue(item.total)
                : item.unitPrice && item.quantity
                  ? extractPriceValue(item.unitPrice) * item.quantity
                  : 0;

              const itemCurrency = item.total?.currency || item.unitPrice?.currency || returnCurrency;

              return (
                <div key={itemIndex} className="flex items-start space-x-2">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                      onError={handleImageError}
                      unoptimized
                    />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-medium text-text-body break-words">{item.name}</div>
                    <div className="text-xs text-text-placeholders">
                      {t('quantity')} {item.quantity}
                      {itemPriceValue > 0 && (
                        <>
                          {' • '}
                          {formatPrice(itemPriceValue, itemCurrency)}
                        </>
                      )}
                    </div>
                    {item.reason && (
                      <div className="text-xs text-text-placeholders mt-1">
                        {t('reason')}: {item.reason.code}
                        {item.reason.details && ` - ${item.reason.details}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {returnItem.orders && returnItem.orders.length > 0 && (
        <div className="p-3 bg-surface-image-background border-t border-border-primary">
          <div className="text-sm font-semibold text-text-body mb-2">{t('relatedOrders')}</div>
          <div className="flex flex-wrap gap-2">
            {returnItem.orders.map((order: any, orderIndex: number) => (
              <a
                key={orderIndex}
                href={`/account/orders/${order.id}`}
                className="text-sm text-text-action hover:text-text-action-hover underline"
              >
                #{order.id}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
