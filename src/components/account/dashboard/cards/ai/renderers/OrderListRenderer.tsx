'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { getOrderStatusColor, formatPrice, formatDate, handleImageError } from '../utils';

interface OrderListRendererProps {
  data: any;
}

// Helper function to extract price values from different formats
const extractPrice = (priceObj: any) => {
  if (!priceObj) return { net: 0, gross: 0, tax: 0 };
  
  let net = priceObj.net ?? priceObj.netValue ?? priceObj.finalNetValue;
  let gross = priceObj.gross ?? priceObj.grossValue ?? priceObj.finalGrossValue;
  let tax = priceObj.tax ?? priceObj.taxValue ?? priceObj.finalTaxValue;
  const value = priceObj.value ?? 0;
  
  // If we have gross and tax, calculate net
  if (gross && tax && !net) {
    net = gross - tax;
  }
  // If we have gross and net, calculate tax
  else if (gross && net && !tax) {
    tax = gross - net;
  }
  // If we have net and tax, calculate gross
  else if (net && tax && !gross) {
    gross = net + tax;
  }
  // If we only have value and no other fields, treat as gross
  else if (value > 0 && !net && !gross && !tax) {
    gross = value;
  }
  // Fallback: use value as gross if gross is missing
  else if (!gross && value > 0) {
    gross = value;
  }
  
  // Final fallbacks to 0
  net = net ?? 0;
  gross = gross ?? 0;
  tax = tax ?? 0;
  
  return { net, gross, tax };
};

export const OrderListRenderer: React.FC<OrderListRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  return (
    <div className="space-y-3">
      {data.orders &&
        data.orders.map((order: any, index: number) => {
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
              {/* Order Header with Blue Gradient Background */}
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
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getOrderStatusColor(
                          order.status,
                        )}`}
                      >
                        {order.status}
                      </span>
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

              {/* Order Items on White Background */}
              {order.items && order.items.length > 0 && (
                <div className="p-3 bg-surface-primary">
                  <div className="text-sm font-semibold text-text-body mb-2">{t('previewItems')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm text-text-body">
                    {order.items.map((item: any, itemIndex: number) => {
                      // Extract price information
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
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded flex-shrink-0"
                              onError={handleImageError}
                            />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="font-medium text-text-body break-words">
                              {item.name}
                            </div>
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

