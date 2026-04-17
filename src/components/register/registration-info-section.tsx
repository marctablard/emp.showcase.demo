'use client';

import type { Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H2 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface RegistrationInfoAccordionProps {
  control: Control<any>;
  number: number;
}

export function RegistrationInfoSection({ control, number }: RegistrationInfoAccordionProps) {
  const t = useTranslations('auth.register');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H2 variant="h5">
          {number}. {t('registrationInfo')}
        </H2>
        <Separator />
      </div>
      <div className="space-y-6">
        <FormField
          control={control}
          name="firstName"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="firstName">{t('firstName')}</FormLabel>
              <FormControl>
                <Input id="firstName" type="text" required {...field} data-testid="register-firstName" />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="lastName"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="lastName">{t('lastName')}</FormLabel>
              <FormControl>
                <Input id="lastName" type="text" required {...field} data-testid="register-lastName" />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="email">{t('email')}</FormLabel>
              <FormControl>
                <Input id="email" type="email" required {...field} data-testid="register-email" />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="emailConfirmation"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="emailConfirmation">{t('emailConfirmation')}</FormLabel>
              <FormControl>
                <Input
                  id="emailConfirmation"
                  type="email"
                  required
                  {...field}
                  data-testid="register-emailConfirmation"
                />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="businessType"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="businessType">{t('businessType')}</FormLabel>
              <FormControl>
                <RadioGroup
                  id="businessType"
                  className="flex mt-2"
                  value={field.value}
                  onValueChange={field.onChange}
                  data-testid="register-businessType"
                >
                  <FormItem className="flex">
                    <FormControl>
                      <RadioGroupItem value="B2B" id="B2B" data-testid="register-businessType-B2B" />
                    </FormControl>
                    <FormLabel className="w-full font-medium" htmlFor="B2B">
                      {t('businessTypeB2B')}
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex">
                    <FormControl>
                      <RadioGroupItem value="B2C" id="B2C" data-testid="register-businessType-B2C" />
                    </FormControl>
                    <FormLabel className="w-full font-medium" htmlFor="B2C">
                      {t('businessTypeB2C')}
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
