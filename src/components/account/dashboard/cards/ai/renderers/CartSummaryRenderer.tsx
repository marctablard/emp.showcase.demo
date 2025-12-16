'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CartSummaryData, ShopData } from '../types';
import { extractPrice, formatPrice } from '../utils';
import { ItemsListRenderer } from './ItemsListRenderer';

interface CartSummaryRendererProps {
  data: CartSummaryData;
}

export const CartSummaryRenderer: React.FC<CartSummaryRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  const displayCurrency = data.currency || data.total?.currency || 'USD';

  const total = data.total || {};
  const totalPrice = extractPrice(total);
  const totalValue = totalPrice.gross;
  const totalNet = totalPrice.net;
  const totalTax = totalPrice.tax;

  const subtotal = data.subtotal || {};
  const subtotalPrice = extractPrice(subtotal);
  const subtotalNet = subtotalPrice.net;
  const subtotalTax = subtotalPrice.tax;
  const subtotalGross = subtotalPrice.gross;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start p-6 rounded-xl border border-border-primary shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-on-action">{t('cartSummary')}</h3>
          {data.siteCode && (
            <span className="text-xs font-medium text-text-on-action bg-surface-action/30 px-2.5 py-1 rounded-full">
              {data.siteCode}
            </span>
          )}
        </div>

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

      {data.items && data.items.length > 0 && (
        <div className="space-y-4">
          <ItemsListRenderer
            items={data.items}
            currency={displayCurrency}
            extractPrice={extractPrice}
            showImages={true}
            showDescription={false}
            linkToProduct={false}
          />
        </div>
      )}

      {data.shops && data.shops.length > 0 && (
        <div className="space-y-4">
          {data.shops.map((shop: ShopData, shopIndex: number) => (
            <div key={shopIndex} className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-surface-image-background rounded-lg border">
                <div className="font-semibold text-text-body text-base">{shop.shopName}</div>
                <div className="text-sm font-medium text-text-body">
                  {t('subtotal')} {formatPrice(shop.subtotal || 0, shop.currency)}
                </div>
              </div>

              {shop.items && shop.items.length > 0 && (
                <ItemsListRenderer
                  items={shop.items}
                  currency={shop.currency || displayCurrency}
                  extractPrice={extractPrice}
                  showImages={true}
                  showDescription={false}
                  linkToProduct={false}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <button
          onClick={() => (window.location.href = '/cart')}
          className="px-6 py-3 bg-surface-action text-text-on-action font-semibold rounded-lg hover:bg-surface-action-hover transition-colors shadow-sm hover:shadow-md"
        >
          {t('goToCheckout')}
        </button>
      </div>
    </div>
  );
};
