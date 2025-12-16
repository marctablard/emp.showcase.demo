'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { formatPrice, handleImageError } from '../utils';

export interface UnifiedProductItem {
  productId?: string;
  itemId?: string;
  id?: string;

  name: string;
  image?: string;
  description?: string;
  brand?: string;

  quantity?: number;
  unitCode?: string;

  price?: number;
  currency?: string;

  unitPrice?: {
    value: number;
    currency?: string;
    net?: number;
    gross?: number;
    tax?: number;
  };
  totalPrice?: {
    value: number;
    currency?: string;
    net?: number;
    gross?: number;
    tax?: number;
  };

  originalPrice?: number;
  rating?: number;
  reviewCount?: number;
  availability?: string;
}

interface ProductItemProps {
  item: UnifiedProductItem;
  currency?: string;
  showQuantity?: boolean;
  showUnitPrice?: boolean;
  showTotalPrice?: boolean;
  showNetGross?: boolean;
  linkToProduct?: boolean;
  className?: string;
}

/**
 * Unified ProductItem component for displaying products/items consistently
 * across cart, quotes, orders, and product lists.
 */
export const ProductItem: React.FC<ProductItemProps> = ({
  item,
  currency,
  showQuantity = true,
  showUnitPrice = true,
  showTotalPrice = true,
  showNetGross = false,
  linkToProduct = false,
  className = '',
}) => {
  const t = useTranslations('account.AiHelper');

  // Determine currency to use
  const itemCurrency = item.unitPrice?.currency || item.totalPrice?.currency || item.currency || currency || 'USD';

  // Get unit price
  const unitPriceValue = item.unitPrice?.value ?? item.price ?? 0;
  const unitPriceNet = item.unitPrice?.net ?? item.unitPrice?.value;
  const unitPriceGross = item.unitPrice?.gross ?? item.unitPrice?.value;

  // Get total price
  const quantity = item.quantity ?? 1;
  const totalPriceValue = item.totalPrice?.value ?? (item.price ? item.price * quantity : 0);
  const totalPriceNet = item.totalPrice?.net ?? item.totalPrice?.value;
  const totalPriceGross = item.totalPrice?.gross ?? item.totalPrice?.value;

  // Product link
  const productId = item.productId;
  const productLink = linkToProduct && productId ? `/product/${productId}` : undefined;

  const nameElement = productLink ? (
    <a
      href={productLink}
      className="font-semibold text-text-headings text-base hover:text-text-action transition-colors"
    >
      {item.name}
    </a>
  ) : (
    <div className="font-semibold text-text-headings text-base">{item.name}</div>
  );

  return (
    <div className={`flex items-start space-x-4 ${className}`}>
      {item.image && (
        <Image
          src={item.image}
          alt={item.name}
          width={80}
          height={80}
          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
          onError={handleImageError}
          unoptimized
        />
      )}
      <div className="flex-1 min-w-0">
        {nameElement}
        {item.description && <div className="text-sm text-text-body mb-2 line-clamp-2">{item.description}</div>}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showQuantity && quantity > 0 && (
              <div className="text-sm text-text-body mb-1">
                {t('quantity')} <span className="font-medium">{quantity}</span>
              </div>
            )}
            {showUnitPrice && unitPriceValue > 0 && (
              <div className="text-sm text-text-body">
                {t('unit')}{' '}
                {showNetGross && unitPriceNet && item.unitPrice?.tax && item.unitPrice.tax > 0 ? (
                  <>
                    {t('net')} <span className="font-medium">{formatPrice(unitPriceNet, itemCurrency)}</span>
                    {' • '}
                    {t('vat')} <span className="font-medium">{formatPrice(item.unitPrice.tax, itemCurrency)}</span>
                    {' • '}
                    {t('gross')}{' '}
                    <span className="font-medium">{formatPrice(unitPriceGross ?? unitPriceValue, itemCurrency)}</span>
                  </>
                ) : (
                  <span className="font-medium">{formatPrice(unitPriceValue, itemCurrency)}</span>
                )}
              </div>
            )}
          </div>
          {showTotalPrice && totalPriceValue > 0 && (
            <div className="text-right">
              {showNetGross && totalPriceNet && (
                <div className="text-sm text-text-body mb-1">
                  {t('net')} <span className="font-medium">{formatPrice(totalPriceNet, itemCurrency)}</span>
                  {item.totalPrice?.tax && item.totalPrice.tax > 0 && (
                    <>
                      {' • '}
                      {t('vat')} <span className="font-medium">{formatPrice(item.totalPrice.tax, itemCurrency)}</span>
                    </>
                  )}
                </div>
              )}
              <div className="text-lg font-bold text-text-action">
                {t('total')} {formatPrice(totalPriceGross ?? totalPriceValue, itemCurrency)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
