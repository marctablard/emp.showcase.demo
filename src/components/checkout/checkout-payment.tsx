import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, NotebookText, Pencil, ReceiptText } from 'lucide-react';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { Address } from '@/platform/services/model/common';
import { AddressSelector } from '../address/address-selector';
import { AddressDisplay } from '../common/address-display';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { H2 } from '../ui/h';
import CheckoutAddress from './checkout-address';
import PaymentMethodComponent from './payment-method';

export function CheckoutPayment({ initialEdit }: { initialEdit: boolean }) {
  const t = useTranslations('checkout.payment');
  const tPayment = useTranslations('checkout.PaymentModes');
  const { billingAddress, shippingAddress, paymentMethod, submitBillingAddress } = useCheckout();
  const [isPaymentEdit, setIsPaymentEdit] = useState(
    initialEdit || !paymentMethod || !billingAddress || !shippingAddress,
  );

  const handleBillingAddressChange = (address: Address) => {
    submitBillingAddress({
      ...address,
      type: 'BILLING',
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
          onClick={() => (isPaymentEdit ? setIsPaymentEdit(false) : setIsPaymentEdit(true))}
          data-testid="payment-editButton"
        >
          {isPaymentEdit ? (
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
        {!isPaymentEdit ? (
          <>
            <div className="flex flex-col">
              <p className="font-bold mb-1">{t('address')}</p>

              <div className="flex align-center">{billingAddress && <AddressDisplay address={billingAddress} />}</div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col">
                <p className="font-bold mb-1">{t('paymentMethod')}</p>
                <div className="flex align-center">
                  <div>
                    <ReceiptText className="h-4 w-4 mt-1.5 mr-1.5" />
                  </div>
                  <div>{paymentMethod && <p>{tPayment(dk<PaymentModeKey>(paymentMethod.code))}</p>}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Addresses */}
            <AddressSelector
              addressBook="companyAndCustomer"
              addressType="BILLING"
              selectedAddressId={billingAddress?.id}
              onSelect={handleBillingAddressChange}
              triggerElement={
                <div className="flex gap-1 text-text-action font-bold mb-4 cursor-pointer">
                  <p>{t('fromAddressbook')}</p>
                  <NotebookText />
                </div>
              }
            />
            <div className="col-span-2 flex flex-col gap-4">
              <CheckoutAddress
                address={billingAddress}
                addressLabel={t('address')}
                sameAs={
                  shippingAddress
                    ? {
                        referenceAddress: shippingAddress,
                        label: t('billingAddressSameAsShipping'),
                        id: 'billingAddressSameAsShipping',
                      }
                    : undefined
                }
                isReadOnly={false}
                onAddressChange={handleBillingAddressChange}
                testIdPrefix="billing"
              />
              {/* Payment Method */}
              <PaymentMethodComponent />
            </div>

            {/*isPaymentEdit && (
              <div className="col-span-2 flex gap-4 justify-between w-full">
                <Button variant="secondary" onClick={() => setIsPaymentEdit(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitPayment}>
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
