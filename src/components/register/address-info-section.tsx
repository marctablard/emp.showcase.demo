'use client';

import { useEffect } from 'react';
import { Control, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H2 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useSite } from '@/hooks/site/useSite';
import { useL10n } from '@/hooks/useL10n';

interface AddressInfoAccordionProps {
  control: Control<any>;
  number: number;
}

export function AddressInfoSection({ control, number }: AddressInfoAccordionProps) {
  const { loading, countries, fetchSiteData } = useSite();
  const { l10n } = useL10n();
  const t = useTranslations('auth.register');

  // useWatch auf oberster Ebene der Komponente verwenden
  const businessType = useWatch({
    control,
    name: 'businessType',
  });
  const isB2C = businessType === 'B2C';

  useEffect(() => {
    if (!countries) {
      fetchSiteData();
    }
  }, [fetchSiteData, countries]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H2 variant="h5">
          {number}. {t('addressInfo')}
        </H2>
        <Separator />
      </div>
      <div className="space-y-6">
        <FormField
          control={control}
          name="companyName"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="companyName" className="flex flex-nowrap">
                {t('companyName')}
                {isB2C && <span className="text-text-placeholders text-sm ml-1"> {t('optional')}</span>}
              </FormLabel>
              <FormControl>
                <Input id="companyName" type="text" {...field} data-testid="register-companyName" />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        {/*}
                    <FormField
                        control={control}
                        name="businessType"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel htmlFor="businessType">{t('businessType')}</FormLabel>
                                <FormControl>
                                    <Input id="businessType" type="text" {...field}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {*/}
        <FormField
          control={control}
          name="vatNumber"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="vatNumber" className="flex flex-nowrap">
                {t('vatNumber')}
                {isB2C && <span className="text-text-placeholders text-sm ml-1"> {t('optional')}</span>}
              </FormLabel>
              <FormControl>
                <Input id="vatNumber" type="text" {...field} data-testid="register-vatNumber" />
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <div className="flex gap-6 items-start">
          <FormField
            control={control}
            name="street"
            render={({ field }) => (
              <FormItem className="w-2/3 sm:w-3/4 relative">
                <FormLabel htmlFor="street">{t('street')}</FormLabel>
                <FormControl>
                  <Input id="street" type="text" required {...field} data-testid="register-street" />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="houseNumber"
            render={({ field }) => (
              <FormItem className="w-1/3 sm:w-1/4 relative">
                <FormLabel htmlFor="houseNumber" className="overflow-hidden">
                  <p className="text-nowrap whitespace-nowrap overflow-ellipsis overflow-hidden">{t('houseNumber')}</p>
                </FormLabel>
                <FormControl>
                  <Input id="houseNumber" type="text" required {...field} data-testid="register-houseNumber" />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage className="text-nowrap overflow-hidden overflow-ellipsis" />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-6 items-start">
          <FormField
            control={control}
            name="postalCode"
            render={({ field }) => (
              <FormItem className="w-1/3 sm:w-1/4 relative">
                <FormLabel htmlFor="postalCode" className="overflow-hidden">
                  <p className="text-nowrap whitespace-nowrap overflow-ellipsis overflow-hidden">{t('postalCode')}</p>
                </FormLabel>
                <FormControl>
                  <Input id="postalCode" type="text" required {...field} data-testid="register-postalCode" />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage className="text-nowrap overflow-hidden overflow-ellipsis" />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="city"
            render={({ field }) => (
              <FormItem className="w-2/3 sm:w-3/4 relative">
                <FormLabel htmlFor="city">{t('city')}</FormLabel>
                <FormControl>
                  <Input id="city" type="text" required {...field} data-testid="register-city" />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="country"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="country">{t('country')}</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger data-testid="register-country">
                    <SelectValue placeholder={t('country')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {l10n(country.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <div className="absolute top-full left-0 mt-0.5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="shippingSameAsBilling"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox
                  id="shippingSameAsBilling"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="register-shippingSameAsBilling"
                />
              </FormControl>
              <FormLabel className="font-medium" htmlFor="shippingSameAsBilling">
                {t('shippingSameAsBilling')}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
