'use client';

import React from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useCheckout } from '@/hooks/checkout/useCheckout';
import { useValidator } from '@/hooks/validation/useValidator';
import { ContactData } from '@/platform/services/model/checkout';
import { Card, CardContent, CardHeader } from '../ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { H2 } from '../ui/h';
import { Input } from '../ui/input';

interface ContactDataProps {
  initialData?: Partial<ContactData>;
  isReadOnly?: boolean;
}

const emptyContactData = {
  email: '',
  emailConfirmation: '',
  phone: '',
  firstName: '',
  lastName: '',
  company: '',
};

/**
 * Customer data form component for checkout
 * Collects basic customer information (email, name)
 */
const ContactDataComponent: React.FC<ContactDataProps> = ({ initialData = undefined }) => {
  const t = useTranslations('checkout.contactData');
  const { submitContactData, contactData } = useCheckout();
  const { form } = useValidator(
    'ContactDataValidationService',
    { ...emptyContactData, ...(initialData || contactData) },
    'onBlur',
    submitContactData,
  );

  return (
    <Card className="p-0 shadow-footer border-none mb-6">
      <CardHeader className="p-0 mt-6 mx-6 border-b border-neutral-200 [.border-b]:pb-0 flex justify-between">
        <H2 variant="h5" className="col-start-1 font-bold text-xl">
          {t('title')}
        </H2>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <p className="text-xs">{t('info')}</p>
          <FormProvider {...form}>
            <div className="bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="firstName">{t('firstName')}*</FormLabel>
                        <FormControl>
                          <Input id="firstName" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="lastName">{t('lastName')}*</FormLabel>
                        <FormControl>
                          <Input id="lastName" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <div className="bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 space-y-2 gap-4">
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="email">{t('emailAddress')}*</FormLabel>
                        <FormControl>
                          <Input id="email" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="emailConfirmation"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="emailConfirmation">{t('confirmEmailAddress')}*</FormLabel>
                        <FormControl>
                          <Input id="emailConfirmation" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-1 mb-6">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="email">{t('companyName')}</FormLabel>
                        <FormControl>
                          <Input id="company" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel htmlFor="phone">{t('phoneNumber')}</FormLabel>
                        <FormControl>
                          <Input id="phone" type="text" {...field} />
                        </FormControl>
                        <div className="absolute top-full left-0 mt-0.5">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </FormProvider>
        </div>
      </CardContent>
    </Card>
  );
};
export default ContactDataComponent;
