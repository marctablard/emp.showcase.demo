'use client';

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { H5 } from '@/components/ui/h';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import type { Address } from '@/platform/services/model/common';
import { AddressSelector } from '../address/address-selector';
import ShippingMethod from '../checkout/shipping-method';
import { AddressDisplay } from '../common/address-display';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export function CartDelivery() {
  const t = useTranslations('cart');
  const pickupAddress: Address = {
    companyName: 'Emporix AG',
    contactName: 'Philipp Grunewald',
    street: 'Bundesplatz',
    streetNumber: '16',
    city: 'Zug',
    country: 'Switzerland',
    zipCode: '300',
  };

  const { shippingAddress, shippingMethod, submitShippingAddress } = useCheckout();
  const isPickup = shippingMethod?.methodId === 'pickup';

  return (
    <Card className="p-0 border-none shadow-sm mb-4 md:mb-6">
      <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2">
        <ShippingMethod variant="slim" />
        <div className="flex flex-col gap-4 pt-4 sm:pt-0">
          <div className="flex justify-between">
            <H5>{isPickup ? t('pickup') : t('ship')}</H5>
            <AddressSelector
              addressBook="auto"
              addressType="SHIPPING"
              onSelect={(address) => submitShippingAddress({ ...address, type: 'SHIPPING' })}
              selectedAddressId={shippingAddress?.id}
              triggerElement={
                <Button
                  variant="link"
                  size="default"
                  className="normal-case text-base tracking-normal p-0 gap-1 underline"
                >
                  {t('change')}
                  <Pencil />
                </Button>
              }
              title={t('selectShippingAddress')}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {shippingAddress && !isPickup && <AddressDisplay address={shippingAddress} />}
            {isPickup && (
              <>
                <AddressDisplay address={pickupAddress} />
                <div className="flex flex-col lg:pe-4 text-base w-full sm:w-1/2">
                  <div>
                    <span className="font-bold font-headlines">{t('hours')}</span>
                    <span>M-F 7:00 AM - 4:00 PM Central</span>
                  </div>
                  <div>
                    <span className="font-bold font-headlines">{t('phone')}</span>
                    <span>0123 987654-32</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
