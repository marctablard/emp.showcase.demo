'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { OrderData, OrderItemData, OrderListData } from '../types';
import { extractPrice, formatDate, formatPrice, getOrderStatusBadgeVariantForAi, handleImageError } from '../utils';

interface OrderListRendererProps {
  data: OrderListData;
}

export const OrderListRenderer: React.FC<OrderListRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  return (
    <div className="space-y-3">
      {data.orders &&
        data.orders.map((order: OrderData, index: number) => {
          const orderCurrency = order.currency || 'EUR';
          const totalPrice = extractPrice(order.total);
          const totalGross = totalPrice.gross || 0;
          const totalNet = totalPrice.net || 0;
          const totalTax = totalPrice.tax || 0;

          return (
            <div
              key={index}
              className="bg-surface-primary rounded-xl border border-border-primary shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <a
                        href={`/account/orders/${order.orderId}`}
                        className="text-text-on-action hover:text-text-on-action/80 font-semibold text-base underline truncate"
                      >
                        #{order.orderId}
                      </a>
                      <Badge
                        variant={getOrderStatusBadgeVariantForAi(order.status)}
                        size="status"
                        className="flex-shrink-0 max-w-full truncate"
                      >
                        {order.status}
                      </Badge>
                      {order.siteCode && (
                        <span className="text-xs font-medium text-text-on-action bg-surface-action/30 px-2.5 py-1 rounded-full flex-shrink-0">
                          {order.siteCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-text-on-action/90">
                      <div className="flex items-center space-x-1">
                        <span>📅</span>
                        <span>{formatDate(order.date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>📦</span>
                        <span>
                          {order.totalItems || order.itemCount || 0} {t('items')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="text-lg font-bold text-text-on-action">
                      {formatPrice(totalGross, orderCurrency)}
                    </div>
                    {(totalNet > 0 || totalTax > 0) && (
                      <div className="text-xs text-text-on-action/90">
                        {totalNet > 0 && (
                          <>
                            {t('net')} {formatPrice(totalNet, orderCurrency)}
                          </>
                        )}
                        {totalNet > 0 && totalTax > 0 && ' • '}
                        {totalTax > 0 && (
                          <>
                            {t('tax')} {formatPrice(totalTax, orderCurrency)}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="p-3 bg-surface-primary">
                  <div className="text-sm font-semibold text-text-body mb-2">{t('previewItems')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm text-text-body">
                    {order.items.map((item: OrderItemData, itemIndex: number) => {
                      const itemPrice = item.totalPrice
                        ? extractPrice(item.totalPrice)
                        : item.unitPrice && item.quantity
                          ? {
                              net: (item.unitPrice.net || 0) * item.quantity,
                              gross: (item.unitPrice.gross || item.unitPrice.value || 0) * item.quantity,
                              tax: (item.unitPrice.tax || 0) * item.quantity,
                            }
                          : { net: 0, gross: 0, tax: 0 };

                      const itemCurrency = item.totalPrice?.currency || item.unitPrice?.currency || orderCurrency;

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
                              {(itemPrice.net > 0 || itemPrice.gross > 0 || itemPrice.tax > 0) && (
                                <>
                                  {' • '}
                                  {itemPrice.net > 0 && (
                                    <>
                                      {t('net')} {formatPrice(itemPrice.net, itemCurrency)}
                                    </>
                                  )}
                                  {itemPrice.net > 0 && itemPrice.tax > 0 && ' • '}
                                  {itemPrice.tax > 0 && (
                                    <>
                                      {t('vat')} {formatPrice(itemPrice.tax, itemCurrency)}
                                    </>
                                  )}
                                  {(itemPrice.net > 0 || itemPrice.tax > 0) && itemPrice.gross > 0 && ' • '}
                                  {itemPrice.gross > 0 && (
                                    <>
                                      {t('gross')} {formatPrice(itemPrice.gross, itemCurrency)}
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
