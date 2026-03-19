'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { H2 } from '@/components/ui/h';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useValidator } from '@/hooks/validation/useValidator';
import { formatCurrency } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Spinner } from '../ui/spinner';

interface ShippingMethodProps {
  isReadOnly?: boolean;
  variant?: 'default' | 'slim';
}

/**
 * Shipping method selection component
 * Allows users to select their preferred shipping method
 */
const ShippingMethod: React.FC<ShippingMethodProps> = ({ isReadOnly = false, variant = 'default' }) => {
  const {
    availableShippingMethods: shippingMethods,
    shippingMethodsLoading: loading,
    shippingMethod,
    submitShippingMethod,
  } = useCheckout();

  const { form } = useValidator('ShippingValidationService', shippingMethod, 'onChange', (data) => {
    const option = shippingMethods?.find((option) => option.id === data.methodId);
    if (option) {
      submitShippingMethod(option);
    }
  });
  const t = useTranslations('checkout.shipping');
  return (
    <Form {...form}>
      <div className="bg-surface-page">
        <H2 variant="h5" className="mb-2">
          {t('shippingMethod')}
        </H2>
        <div className="flex gap-2 items-center text-text-action mb-4">
          <Info className="w-4 h-4" />
          <p className="text-sm">{t('multiplePackages')}</p>
        </div>
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Spinner variant="md" loadingText={t('loading')} />
          </div>
        )}
        {!loading && (!shippingMethods || shippingMethods.length === 0) && (
          <div className="py-4 text-center text-text-on-disabled">{t('noShippingMethodsAvailable')}</div>
        )}

        <FormField
          control={form.control}
          name="methodId"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                  data-testid="shipping-methodGroup"
                >
                  {shippingMethods!.map((method) => (
                    <FormItem
                      className={
                        variant === 'default'
                          ? 'flex items-center space-x-3 space-y-0 w-full'
                          : 'flex items-center space-y-0 w-full'
                      }
                      key={method.id}
                    >
                      <div
                        className={
                          variant === 'default'
                            ? `flex gap-4 items-center w-full border rounded-md p-4 cursor-pointer transition-colors ${
                                shippingMethod?.methodId === method.id
                                  ? 'border-border-secondary bg-surface-action-hover-2'
                                  : 'border-border-primary hover:border-border-action-hover'
                              } ${isReadOnly ? 'bg-surface-disabled text-text-on-disabled border-border-disabled pointer-events-none' : ''}`
                            : `flex items-center w-full cursor-pointer transition-colors ${
                                shippingMethod?.methodId === method.id
                                  ? 'border-border-secondary'
                                  : 'border-border-primary hover:border-border-action-hover'
                              } ${isReadOnly ? 'bg-surface-disabled text-text-on-disabled border-border-disabled pointer-events-none' : ''}`
                        }
                      >
                        <FormControl>
                          <RadioGroupItem
                            value={method.id}
                            id={method.id}
                            data-testid={`shipping-method-${method.id}`}
                          />
                        </FormControl>
                        <FormLabel className="w-full font-medium" htmlFor={method.id}>
                          <div className="flex items-start justify-between w-full">
                            <div>
                              <p>{method.name}</p>
                              <p className="text-sm text-text-placeholders">{method.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-medium">
                                {!method.cost
                                  ? t('freeShipping')
                                  : formatCurrency(method.cost.amount, method.cost.currency)}
                              </span>
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
};

export default ShippingMethod;
