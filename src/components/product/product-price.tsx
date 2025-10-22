'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency, formatCurrencyToParts } from '@/lib/utils';
import { ProductPrice } from '@/platform/services/model/price';

interface ProductPriceProps {
  price: ProductPrice | null;
  isAddToCartBar?: boolean;
}

export function ProductPriceComponent({ price, isAddToCartBar }: ProductPriceProps) {
  const t = useTranslations('product.price');

  if (price === null) {
    return null;
  }

  const parts = formatCurrencyToParts(price.amount, price.currency);
  let priceFragment: React.ReactNode[];
  if (parts.length === 0) {
    priceFragment = [<>{t('notAvailable')}</>];
  } else {
    const decimal = parts.find((part) => part.type === 'decimal')?.value || '.';

    priceFragment = [
      parts.map((part, index) => {
        if (part.type === 'currency') {
          return (
            <span key={index} className="text-4xl">
              {part.value}
            </span>
          );
        }
        if (part.type === 'literal') {
          return <span key={index}>{part.value}</span>;
        }
        if (part.type === 'integer') {
          return (
            <span key={index} className="text-4xl">
              {Math.floor(Number(part.value))}
            </span>
          );
        }
        if (part.type === 'fraction') {
          return (
            <span key={index} className="text-md align-top">
              {decimal}
              {part.value}
            </span>
          );
        }
      }),
    ];
  }
  return (
    <div className="flex gap-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('yourPrice')}</span>
          {price.discountPercentage > 0 && (
            <>
              <span className="text-sm font-medium ml-[-0.5em]">, {t('including')}</span>
              <Badge variant="destructive" rounded="default">
                -{Math.round(price.discountPercentage)}%
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-baseline gap-4">
          <div className={cn('font-bold font-headlines', isAddToCartBar ? 'text-white' : 'text-neutral-900')}>
            {priceFragment}
          </div>
          {price.tax && isAddToCartBar && (
            <>
              {price.includesTax ? (
                <>
                  {t('includingTax', { taxRate: price.tax.taxRate })} /{' '}
                  {formatCurrency(price.tax.netValue, price.currency)} {t('net')}
                </>
              ) : (
                <>
                  {t('excludingTax', { taxRate: price.tax.taxRate })} /{' '}
                  {formatCurrency(price.tax.grossValue, price.currency)} {t('gross')}
                </>
              )}
            </>
          )}
        </div>

        {price.tax && (
          <div className={cn('text-sm mb-2', isAddToCartBar ? 'text-white' : 'text-neutral-600')}>
            {!isAddToCartBar && price.includesTax ? (
              <>
                {t('includingTax', { taxRate: price.tax.taxRate })} /{' '}
                {formatCurrency(price.tax.netValue, price.currency)} {t('net')}
              </>
            ) : (
              <>
                {t('excludingTax', { taxRate: price.tax.taxRate })} /{' '}
                {formatCurrency(price.tax.grossValue, price.currency)} {t('gross')}
              </>
            )}
          </div>
        )}
      </div>
      <div>
        {price.originalAmount && price.originalAmount > price.amount && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('listPrice')}</span>
            <div>
              <div className={cn('line-through', isAddToCartBar ? 'text-white text-xl' : 'text-neutral-600')}>
                {formatCurrency(price.originalAmount, price.currency)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wait for a proper styling for List Prices
      {price.tierValues?.length > 0 && (
        <div className="mt-2 space-y-2">
          {price.tierValues.map((tier, index) => (
            <div key={index} className="flex items-center text-sm text-neutral-500">
              <span className="font-medium mr-2">{tier.minQuantity}+</span>
              <span>${tier.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      */}
    </div>
  );
}

export function ProductPriceSkeleton() {
  return (
    <div className="space-y-2 mb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
