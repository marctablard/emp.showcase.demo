'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, MapPin, Package, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';

interface ProductShippingInfoProps {
  className?: string;
  deliveryDays?: [number, number]; // [min, max] days
  shippingCost?: number;
  currency?: string;
  location?: string;
  postalCode?: string;
  warrantyYears?: number;
  returnDays?: number;
}

export function ProductShippingInfo({
  className,
  deliveryDays = [1, 3],
  shippingCost = 9.95,
  currency = 'EUR',
  location = 'London',
  postalCode = 'NW1 6XE',
  warrantyYears = 5,
  returnDays = 30,
}: ProductShippingInfoProps) {
  const t = useTranslations('product.shipping');

  return (
    <Card variant="gray" rounded="lg" className={cn('mt-8 p-0', className)}>
      <CardContent className="px-6 md:px-8 pt-6 pb-6 md:pb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <H2 className="text-base mb-4">{t('deliveryDetails')}</H2>

          <div className="flex items-center gap-2 text-sm mb-2">
            <Package className={deliveryDays[0] === 0 ? 'text-icon-success' : 'text-icon-warning'} />
            {deliveryDays[0] === 0 ? (
              <span>{t('immediatelyDeliverable')}</span>
            ) : (
              <span>{t('deliverable', { min: deliveryDays[0], max: deliveryDays[1] })}</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm mb-2 ml-8">
            {shippingCost > 0 ? (
              <span>
                {t('shipping')}: {shippingCost.toFixed(2)}
                {currency === 'EUR' ? ' €' : ` ${currency}`}
              </span>
            ) : (
              <span className="ml-4">{t('freeShipping')}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="text-icon-success" />
            <span>{t('canBeReserved', { location, postalCode })}</span>
          </div>
        </div>

        <div>
          <H2 className="text-base mb-4">{t('yourUsps')}</H2>

          <div className="flex items-center gap-2 text-sm mb-2">
            <Check className="text-icon-success" />
            <span>{t('warranty', { years: warrantyYears })}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="text-icon-success" />
            <span>{t('returnRight', { days: returnDays })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
