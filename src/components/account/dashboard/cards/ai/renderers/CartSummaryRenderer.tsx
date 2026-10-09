'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { cn } from '@/lib/utils';
import type { CartItemData, CartSummaryData, ShopData } from '../types';
import { extractPrice, formatPrice } from '../utils';
import {
  type AiProductLine,
  AiProductLines,
  type AiTotalRow,
  AiTotals,
  AiWidgetFooterLink,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
  aiWidgetPaddingX,
} from './ai-widget-kit';

interface CartSummaryRendererProps {
  data: CartSummaryData;
}

const sumItemPrices = (items: CartItemData[] | undefined): { net: number; gross: number; tax: number } | undefined => {
  if (!items || items.length === 0) {
    return undefined;
  }

  let net = 0;
  let gross = 0;
  let tax = 0;

  for (const item of items) {
    if (item.totalPrice) {
      const itemPrice = extractPrice(item.totalPrice);
      net += itemPrice.net;
      gross += itemPrice.gross;
      tax += itemPrice.tax;
      continue;
    }
    if (item.unitPrice) {
      const unitPrice = extractPrice(item.unitPrice);
      const qty = item.quantity || 1;
      net += unitPrice.net * qty;
      gross += unitPrice.gross * qty;
      tax += unitPrice.tax * qty;
      continue;
    }
    if (typeof item.price === 'number') {
      const qty = item.quantity || 1;
      gross += item.price * qty;
    }
  }

  if (gross === 0 && net === 0 && tax === 0) {
    return undefined;
  }
  return { net, gross, tax };
};

const mergePrice = (
  primary: { net: number; gross: number; tax: number },
  fallback?: { net: number; gross: number; tax: number },
): { net: number; gross: number; tax: number } => {
  if (!fallback) {
    return primary;
  }
  return {
    net: primary.net || fallback.net,
    gross: primary.gross || fallback.gross,
    tax: primary.tax || fallback.tax,
  };
};

const priceFromCalculated = (
  data: CartSummaryData,
  key: 'finalPrice' | 'price',
): { net: number; gross: number; tax: number } | undefined => {
  const calculated = (data as { calculatedPrice?: Record<string, unknown> }).calculatedPrice;
  const price = calculated?.[key];
  if (price == null) {
    return undefined;
  }
  const extracted = extractPrice(price);
  if (extracted.gross === 0 && extracted.net === 0 && extracted.tax === 0) {
    return undefined;
  }
  return extracted;
};

const cartItemToLine = (item: CartItemData, currency: string): AiProductLine => {
  const unitNet = item.unitPrice ? extractPrice(item.unitPrice).net : 0;
  const totalNet = item.totalPrice ? extractPrice(item.totalPrice).net : 0;
  return {
    id: item.productId,
    name: item.name,
    imageUrl: item.image,
    quantity: item.quantity,
    unitPrice: unitNet || item.unitNetValue || item.price,
    totalPrice: totalNet || undefined,
    currency: item.currency || item.unitPrice?.currency || item.totalPrice?.currency || currency,
    href: item.productId ? `/product/${item.productId}` : undefined,
  };
};

export const CartSummaryRenderer: React.FC<CartSummaryRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tCommon = useTranslations('common');

  const displayCurrency = data.currency || data.total?.currency || getPublicDefaultCurrency();
  const fromItems = sumItemPrices(data.items);
  const totalPrice = mergePrice(
    mergePrice(extractPrice(data.total || {}), priceFromCalculated(data, 'finalPrice')),
    fromItems,
  );
  const subtotalPrice = mergePrice(
    mergePrice(extractPrice(data.subtotal || {}), priceFromCalculated(data, 'price')),
    fromItems,
  );

  const itemCount = (data.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totals: AiTotalRow[] = [
    { key: 'subtotal', label: t('subtotal'), value: formatPrice(subtotalPrice.net, displayCurrency) },
    ...(totalPrice.tax > 0
      ? [{ key: 'tax', label: tCommon('tax'), value: formatPrice(totalPrice.tax, displayCurrency) }]
      : []),
    {
      key: 'total',
      label: t('grandTotal'),
      value: formatPrice(totalPrice.gross || totalPrice.net, displayCurrency),
      emphasized: true,
    },
  ];

  return (
    <AiWidgetFrame>
      <AiWidgetHeader
        eyebrow={data.siteCode}
        title={t('cartSummary')}
        meta={[itemCount > 0 ? `${itemCount} ${t('items')}` : null]}
      />

      {data.items && data.items.length > 0 ? (
        <div className="border-b border-border-primary">
          <AiProductLines
            testIdPrefix="aiCart"
            lines={data.items.map((item) => cartItemToLine(item, displayCurrency))}
          />
        </div>
      ) : null}

      {data.shops?.map((shop: ShopData, shopIndex: number) => (
        <div key={`${shop.shopName}-${shopIndex}`} className="border-b border-border-primary">
          <div
            className={cn(
              'flex items-baseline justify-between gap-3 bg-surface-image-background py-2 text-xs',
              aiWidgetPaddingX,
            )}
          >
            <span className="font-bold uppercase tracking-[0.08em] text-text-headings">{shop.shopName}</span>
            <span className="tabular-nums text-text-body">
              {t('subtotal')} {formatPrice(shop.subtotal || 0, shop.currency || displayCurrency)}
            </span>
          </div>
          {shop.items && shop.items.length > 0 ? (
            <AiProductLines
              testIdPrefix={`aiCart-shop${shopIndex}`}
              lines={shop.items.map((item) => cartItemToLine(item, shop.currency || displayCurrency))}
            />
          ) : null}
        </div>
      ))}

      <AiWidgetSection>
        <AiTotals rows={totals} />
      </AiWidgetSection>

      <AiWidgetFooterLink href="/cart" testId="aiHelper-goToCart">
        {t('goToCheckout')}
      </AiWidgetFooterLink>
    </AiWidgetFrame>
  );
};
