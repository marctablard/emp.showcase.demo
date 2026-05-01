'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ReceiptText } from 'lucide-react';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useSite } from '@/hooks/site/useSite';
import { useValidator } from '@/hooks/validation/useValidator';
import { type PaymentModeKey, dk } from '@/i18n/dynamic-key';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Spinner } from '../ui/spinner';
import { useRegisterCheckoutForm } from './checkout-validation-registry';

interface PaymentMethodProps {
  isReadOnly?: boolean;
}

/**
 * Payment method selection component for checkout
 */
const PaymentMethodComponent: React.FC<PaymentMethodProps> = ({ isReadOnly = false }) => {
  const { paymentMethod, submitPaymentMethod } = useCheckout();
  const { paymentModes, loading, error } = useSite();
  const { form } = useValidator('PaymentValidationService', paymentMethod, 'onChange', (value) => {
    const mode = paymentModes?.find((mode) => mode.id === value.id);
    if (mode) {
      // TODO handle Provider
      submitPaymentMethod({
        ...mode,
        provider: 'none',
      });
    }
  });
  const rootRef = useRef<HTMLDivElement>(null);
  useRegisterCheckoutForm('payment-method', form, rootRef, { testIdPrefix: 'payment' });

  const t = useTranslations('checkout.payment');
  const tPayment = useTranslations('checkout.PaymentModes');

  return (
    <Form {...form}>
      <div className="space-y-6 bg-surface-page" ref={rootRef}>
        {loading && <Spinner variant="md" loadingText={t('loading')} />}

        {error && <div className="py-4 text-center text-text-error">{t('errorLoadingPaymentMethods')}</div>}

        {!loading && !error && paymentModes?.length === 0 && (
          <div className="py-4 text-center text-text-on-disabled">{t('noPaymentMethodsAvailable')}</div>
        )}

        {!loading && !error && !isReadOnly ? (
          <FormField
            control={form.control}
            name="id"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    className={cn('flex flex-col space-y-1')}
                    data-testid="payment-methodGroup"
                  >
                    <div>
                      <div>
                        {paymentModes?.map((option) => (
                          <div key={option.id}>
                            <FormItem
                              className={cn(
                                'flex items-center border rounded-md p-4',
                                paymentMethod?.code === option.code &&
                                  'border-border-secondary bg-surface-action-hover-2',
                              )}
                            >
                              <FormControl>
                                <RadioGroupItem
                                  value={option.id}
                                  id={option.code}
                                  data-testid={`payment-method-${option.code}`}
                                />
                              </FormControl>
                              <FormLabel htmlFor={option.code} className="font-medium w-full ml-3 block">
                                <div className="flex items-center justify-between">
                                  {tPayment(dk<PaymentModeKey>(option.code))}
                                  {option.code === 'invoice' ? <ReceiptText /> : null}
                                </div>
                              </FormLabel>
                            </FormItem>
                          </div>
                        ))}
                      </div>

                      {/* Credit Card Form */}
                      {paymentMethod?.code === 'credit-card' && (
                        <div className="mt-6 space-y-4 border-t border-border-primary pt-4">
                          <FormField
                            control={form.control}
                            name="cardNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel htmlFor="cardNumber">{t('cardNumber')}</FormLabel>
                                <FormControl>
                                  <Input
                                    id="cardNumber"
                                    type="text"
                                    placeholder="1234 5678 9012 3456"
                                    {...field}
                                    data-testid="payment-cardNumber"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="cardHolder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel htmlFor="cardHolder">{t('cardHolder')}</FormLabel>
                                <FormControl>
                                  <Input
                                    id="cardHolder"
                                    type="text"
                                    placeholder="John Doe"
                                    {...field}
                                    data-testid="payment-cardHolder"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="expiryDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel htmlFor="expiryDate">{t('expiryDate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      id="expiryDate"
                                      type="text"
                                      placeholder="MM/YY"
                                      {...field}
                                      data-testid="payment-expiryDate"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="cvv"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel htmlFor="cvv">{t('cvv')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      id="cvv"
                                      type="text"
                                      placeholder="123"
                                      {...field}
                                      data-testid="payment-cvv"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* PayPal Form */}
                      {paymentMethod?.code === 'paypal' && (
                        <div className="border-t p-4">
                          <p className="text-sm text-text-on-disabled">{t('paypalRedirect')}</p>
                        </div>
                      )}
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          // Read-only view
          <div className="text-text-on-disabled">
            <p className="font-medium">{tPayment(dk<PaymentModeKey>(paymentMethod?.code ?? 'none'))}</p>

            {paymentMethod?.code === 'credit-card' && paymentMethod?.customAttributes?.cardNumber && (
              <p className="text-sm text-text-on-disabled mt-1">
                {t('cardEndingIn')} {paymentMethod.customAttributes.cardNumber.slice(-4)}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="pt-4">
        <FormField
          control={form.control}
          name="additionalInvoice"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="additionalInvoice">{t('additionalInvoice')}</FormLabel>
              <FormControl>
                <Input
                  id="additionalInvoice"
                  type="text"
                  placeholder="Email"
                  {...field}
                  disabled={isReadOnly}
                  data-testid="payment-additionalInvoice"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
};

export default PaymentMethodComponent;
