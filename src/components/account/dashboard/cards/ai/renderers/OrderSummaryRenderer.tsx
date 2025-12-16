'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { OrderItemData, OrderSummaryData } from '../types';
import { extractPrice, formatDate, formatPrice, getOrderStatusColor } from '../utils';
import { ItemsListRenderer } from './ItemsListRenderer';

interface OrderSummaryRendererProps {
  data: OrderSummaryData;
}

export const OrderSummaryRenderer: React.FC<OrderSummaryRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  const displayCurrency = data.currency || data.total?.currency || 'USD';

  const total = data.total || {};
  const totalPrice = extractPrice(total);
  const totalValue = totalPrice.gross;
  const totalNet = totalPrice.net;
  const totalTax = totalPrice.tax;

  const subtotal = data.subtotal || {};
  let subtotalPrice = extractPrice(subtotal);

  if (subtotalPrice.net === 0 && subtotalPrice.gross === 0 && data.items && data.items.length > 0) {
    let itemsNet = 0;
    let itemsGross = 0;
    let itemsTax = 0;

    data.items.forEach((item: OrderItemData) => {
      if (item.totalPrice) {
        const itemPrice = extractPrice(item.totalPrice);
        itemsNet += itemPrice.net || 0;
        itemsGross += itemPrice.gross || 0;
        itemsTax += itemPrice.tax || 0;
      } else if (item.unitPrice && item.quantity) {
        const unitPrice = extractPrice(item.unitPrice);
        const qty = item.quantity || 1;
        itemsNet += (unitPrice.net || 0) * qty;
        itemsGross += (unitPrice.gross || 0) * qty;
        itemsTax += (unitPrice.tax || 0) * qty;
      }
    });

    if (itemsGross > 0 || itemsNet > 0) {
      subtotalPrice = { net: itemsNet, gross: itemsGross, tax: itemsTax };
    }
  }

  const subtotalNet = subtotalPrice.net;
  const subtotalTax = subtotalPrice.tax;
  const subtotalGross = subtotalPrice.gross;

  const shipping = data.shipping || {};
  const shippingPrice = extractPrice(shipping);
  const shippingValue = shippingPrice.gross;
  const shippingNet = shippingPrice.net;
  const shippingTax = shippingPrice.tax;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-6 rounded-xl border border-border-primary shadow-lg">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-primary/30">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <a
                href={`/account/orders/${data.orderId}`}
                className="text-text-on-action hover:text-text-on-action/80 font-semibold text-xl underline"
              >
                #{data.orderId}
              </a>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(
                  data.status,
                )}`}
              >
                {data.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-text-on-action/90">
              <div className="flex items-center space-x-2">
                <span>📅</span>
                <span className="font-medium">{formatDate(data.date)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>📦</span>
                <span className="font-medium">
                  {data.totalItems} {t('items')}
                </span>
              </div>
            </div>
          </div>
          {data.siteCode && (
            <span className="text-xs font-medium text-text-on-action bg-surface-action/30 px-2.5 py-1 rounded-full">
              {data.siteCode}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-text-on-action mb-4">{t('orderSummary')}</h3>

          <div className="grid grid-cols-4 gap-4 mb-3 pb-2 border-b border-border-primary/30">
            <div className="text-sm font-semibold text-text-on-action/80"></div>
            <div className="text-sm font-semibold text-text-on-action text-center">{t('net')}</div>
            <div className="text-sm font-semibold text-text-on-action text-center">{t('vat')}</div>
            <div className="text-sm font-semibold text-text-on-action text-center">{t('gross')}</div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-sm text-text-on-action/90">{t('subtotal')}</div>
              <div className="text-sm font-medium text-text-on-action text-center">
                {formatPrice(subtotalNet, displayCurrency)}
              </div>
              <div className="text-sm font-medium text-text-on-action text-center">
                {formatPrice(subtotalTax, displayCurrency)}
              </div>
              <div className="text-sm font-medium text-text-on-action text-center">
                {formatPrice(subtotalGross, displayCurrency)}
              </div>
            </div>

            {shippingValue > 0 && (
              <div className="grid grid-cols-4 gap-4">
                <div className="text-sm text-text-on-action/90">{t('shipping')}</div>
                <div className="text-sm font-medium text-text-on-action text-center">
                  {formatPrice(shippingNet, displayCurrency)}
                </div>
                <div className="text-sm font-medium text-text-on-action text-center">
                  {formatPrice(shippingTax, displayCurrency)}
                </div>
                <div className="text-sm font-medium text-text-on-action text-center">
                  {formatPrice(shippingValue, displayCurrency)}
                </div>
              </div>
            )}

            <div className="pt-3 mt-3 border-t-2 border-border-primary/50">
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="text-base font-semibold text-text-on-action">{t('total')}</div>
                <div className="text-lg font-bold text-text-on-action text-center">
                  {formatPrice(totalNet, displayCurrency)}
                </div>
                <div className="text-lg font-bold text-text-on-action text-center">
                  {formatPrice(totalTax, displayCurrency)}
                </div>
                <div className="text-lg font-bold text-text-on-action text-center">
                  {formatPrice(totalValue, displayCurrency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(data.shippingAddress || data.billingAddress || data.payment) && (
        <div className="bg-surface-primary rounded-lg border border-border-primary p-4">
          {(data.shippingAddress || data.billingAddress) && (
            <>
              <div className="text-sm font-semibold text-text-body mb-3">{t('addresses')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {data.shippingAddress && (
                  <div className="bg-surface-image-background rounded-lg border border-border-primary p-3">
                    <div className="text-sm font-medium text-text-headings mb-2">{t('shippingAddress')}</div>
                    <div className="text-sm text-text-body space-y-1">
                      {data.shippingAddress.name && <div>{data.shippingAddress.name}</div>}
                      {data.shippingAddress.company && <div>{data.shippingAddress.company}</div>}
                      <div>{data.shippingAddress.addressLine1}</div>
                      {data.shippingAddress.addressLine2 && <div>{data.shippingAddress.addressLine2}</div>}
                      <div>
                        {data.shippingAddress.city}
                        {data.shippingAddress.state && `, ${data.shippingAddress.state}`}{' '}
                        {data.shippingAddress.postalCode}
                      </div>
                      <div>{data.shippingAddress.country}</div>
                    </div>
                  </div>
                )}
                {data.billingAddress && (
                  <div className="bg-surface-image-background rounded-lg border border-border-primary p-3">
                    <div className="text-sm font-medium text-text-headings mb-2">{t('billingAddress')}</div>
                    <div className="text-sm text-text-body space-y-1">
                      {data.billingAddress.name && <div>{data.billingAddress.name}</div>}
                      {data.billingAddress.company && <div>{data.billingAddress.company}</div>}
                      <div>{data.billingAddress.addressLine1}</div>
                      {data.billingAddress.addressLine2 && <div>{data.billingAddress.addressLine2}</div>}
                      <div>
                        {data.billingAddress.city}
                        {data.billingAddress.state && `, ${data.billingAddress.state}`} {data.billingAddress.postalCode}
                      </div>
                      <div>{data.billingAddress.country}</div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {data.payment && (
            <>
              {(data.shippingAddress || data.billingAddress) && (
                <div className="border-t border-border-primary pt-4 mb-3"></div>
              )}
              <div className="text-sm font-semibold text-text-body mb-3">{t('paymentInformation')}</div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-text-body">
                  <span className="font-medium">{t('method')}</span> {data.payment.method}
                </div>
                <div className="text-sm font-medium">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      data.payment.status === 'PAID'
                        ? 'bg-surface-success text-text-success'
                        : data.payment.status === 'PENDING'
                          ? 'bg-surface-warning text-text-warning'
                          : data.payment.status === 'FAILED'
                            ? 'bg-surface-error text-text-error'
                            : 'bg-surface-disabled text-text-body'
                    }`}
                  >
                    {data.payment.status}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {data.items && data.items.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-text-body mb-3">{t('orderItems')}</div>
          <ItemsListRenderer
            items={data.items}
            currency={displayCurrency}
            extractPrice={extractPrice}
            showImages={true}
            showDescription={false}
            linkToProduct={true}
          />
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <a
          href={`/account/orders/${data.orderId}`}
          className="px-6 py-3 bg-surface-action text-text-on-action font-semibold rounded-lg hover:bg-surface-action-hover transition-colors shadow-sm hover:shadow-md"
        >
          {t('viewFullOrderDetails')}
        </a>
      </div>
    </div>
  );
};
