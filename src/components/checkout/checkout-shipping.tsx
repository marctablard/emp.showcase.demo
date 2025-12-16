import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, NotebookText, Package, Pencil } from 'lucide-react';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useAddresses } from '@/hooks/customer/useAddresses';
import { Address } from '@/platform/services/model/common';
import { AddressSelector } from '../address/address-selector';
import { AddressDisplay } from '../common/address-display';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { H2 } from '../ui/h';
import CheckoutAddress from './checkout-address';
import ShippingMethod from './shipping-method';

export function CheckoutShipping({ initialEdit }: { initialEdit: boolean }) {
  const t = useTranslations('checkout.shipping');
  const { addresses } = useAddresses();
  const { shippingAddress, shippingMethod, submitShippingAddress } = useCheckout();
  const [isShippingEdit, setIsShippingEdit] = useState(initialEdit || !shippingAddress || !shippingMethod);

  const handleShippingAddressChange = (address: Address) => {
    submitShippingAddress({
      ...address,
      type: 'SHIPPING',
    });
  };

  return (
    <Card className="p-0 border-none mb-6">
      <CardHeader className="p-0 mt-6 mx-6 border-b flex justify-between">
        <H2 variant="h5" className="col-start-1">
          {t('title')}
        </H2>

        <Button
          variant="link"
          size="default"
          className="normal-case text-base tracking-normal p-0 gap-1 underline"
          onClick={() => (isShippingEdit ? setIsShippingEdit(false) : setIsShippingEdit(true))}
        >
          {isShippingEdit ? (
            <>
              {t('close')} <Check />
            </>
          ) : (
            <>
              {t('change')} <Pencil />
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {!isShippingEdit ? (
          <>
            <div className="flex flex-col pb-4">
              <p className="font-bold mb-1">{t('address')}</p>
              <div className="flex align-center">{shippingAddress && <AddressDisplay address={shippingAddress} />}</div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col">
                <p className="font-bold mb-1">{t('shippingMethod')}</p>
                <div className="flex align-center">
                  <div>
                    <Package className="h-4 w-4 mt-1.5 mr-1.5" />
                  </div>
                  <div>
                    <p>{shippingMethod?.methodName}</p>
                    {/*<p>Arrives on July 12, 2025</p>*/}
                  </div>
                </div>
              </div>
              {/*
              <div className="flex flex-col">
                <p className="font-bold mb-1">{t('freightShipping')}</p>
                <div className="flex align-center">
                  <div>
                    <Truck className="h-4 w-4 mt-1.5 mr-1.5" />
                  </div>
                  <div>
                    <p>{t('freightInfo')}</p>
                  </div>
                </div>
              </div>
              */}
            </div>
          </>
        ) : (
          <>
            <div className="col-span-2 flex flex-col gap-4">
              {/* Addresses */}
              {addresses && addresses.length > 0 && (
                <AddressSelector
                  addressType="SHIPPING"
                  selectedAddressId={shippingAddress?.id}
                  onSelect={handleShippingAddressChange}
                  triggerElement={
                    <div className="flex gap-1 text-text-action font-bold mb-4 cursor-pointer">
                      <p>{t('fromAddressbook')}</p>
                      <NotebookText />
                    </div>
                  }
                />
              )}
              {/* Address Input */}
              <CheckoutAddress
                address={shippingAddress}
                addressLabel={t('address')}
                isReadOnly={false}
                onAddressChange={handleShippingAddressChange}
              />
              {/* Shipping Method */}
              <ShippingMethod />
            </div>

            {/*isShippingEdit && (
              <div className="col-span-2 flex gap-4 justify-between w-full">
                <Button variant="secondary" onClick={() => setIsShippingEdit(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitDelivery}>
                  {t('saveChanges')}
                  <Save />
                </Button>
              </div>
            )*/}
          </>
        )}
      </CardContent>
    </Card>
  );
}
