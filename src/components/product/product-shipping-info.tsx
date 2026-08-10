'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, Check, MapPin, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { H6 } from '@/components/ui/h';
import { getPublicDefaultCurrency, getPublicDefaultPostalCode } from '@/lib/common/public-default-env';
import { cn, formatCurrency } from '@/lib/utils';

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
  // Follow-up: replace with product/availability-derived delivery window when a real source is wired.
  deliveryDays = [1, 3],
  shippingCost,
  currency,
  // Follow-up: replace with session/customer shipping city when a real source is wired.
  location = 'London',
  // Follow-up: prefer session shipping zip; display fallback uses getPublicDefaultPostalCode() (not NW1 6XE with DE).
  postalCode = getPublicDefaultPostalCode(),
  // Follow-up: replace with product/CMS warranty years when a real source is wired.
  warrantyYears = 5,
  // Follow-up: replace with product/CMS return policy days when a real source is wired.
  returnDays = 30,
}: Readonly<ProductShippingInfoProps>) {
  const t = useTranslations('product.shipping');
  const resolvedCurrency = currency ?? getPublicDefaultCurrency();

  return (
    <Card variant="gray" rounded="lg" className={cn('mt-8 mb-8 md:mb-0 p-0', className)}>
      {/* D3: single column through tablet (0–1023); two columns from md (1024+). Intentional override of Figma 12823:84897. */}
      <CardContent className="px-6 md:px-8 pt-6 pb-6 md:pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <H6 className="mb-4">{t('deliveryDetails')}</H6>

          <div className="flex items-center gap-2 text-sm mb-2">
            <Truck className={deliveryDays[0] === 0 ? 'text-icon-success' : 'text-icon-warning'} />
            {deliveryDays[0] === 0 ? (
              <span>{t('immediatelyDeliverable')}</span>
            ) : (
              <span>{t('deliverable', { min: deliveryDays[0], max: deliveryDays[1] })}</span>
            )}
          </div>

          {shippingCost !== undefined && (
            <div className="flex items-center gap-2 text-sm mb-2">
              {shippingCost > 0 ? (
                <span>
                  {t('shipping')}: {formatCurrency(shippingCost, resolvedCurrency)}
                </span>
              ) : (
                <span className="ml-4">{t('freeShipping')}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="text-icon-success" />
            <span>{t('canBeReserved', { location, postalCode })}</span>
          </div>
        </div>

        <div>
          <H6 className="mb-4">{t('yourUsps')}</H6>

          <div className="flex items-center gap-2 text-sm mb-2">
            <Check className="text-icon-success" />
            <span>{t('warranty', { years: warrantyYears })}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <ArrowLeftRight className="text-icon-success" />
            <span>{t('returnRight', { days: returnDays })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
