'use client';

import { useEffect, useMemo } from 'react';
import type { Control } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H2, H3 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useSite } from '@/hooks/site/useSite';
import { useL10n } from '@/hooks/useL10n';
import { sortCountriesByDisplayName } from '@/lib/common/sort-countries-by-display-name';
import type { RegistrationData } from '@/lib/validation/form-schemas';
import type { Country } from '@/platform/services/model/common';

interface AddressInfoAccordionProps {
  control: Control<RegistrationData>;
  number: number;
}

const billingTid = (field: string) => `register-billing-${field}`;

function RegistrationBillingFields({
  control,
  countries,
}: Readonly<{
  control: Control<RegistrationData>;
  countries: Country[] | undefined;
}>) {
  const t = useTranslations('auth.register');
  const tAddress = useTranslations('account.AddressForm');
  const { l10n } = useL10n();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H3 variant="h5">{t('billingAddressInfo')}</H3>
        <Separator />
      </div>

      <FormField
        control={control}
        name="billingCompanyName"
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel htmlFor="billingCompanyName">{t('companyName')}</FormLabel>
            <FormControl>
              <Input id="billingCompanyName" type="text" {...field} data-testid={billingTid('companyName')} />
            </FormControl>
            <div className="absolute top-full left-0 mt-0.5">
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="billingContactName"
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel htmlFor="billingContactName">{tAddress('fullName')}*</FormLabel>
            <FormControl>
              <Input id="billingContactName" type="text" {...field} data-testid={billingTid('contactName')} />
            </FormControl>
            <div className="absolute top-full left-0 mt-0.5">
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
        <div className="sm:col-span-5">
          <FormField
            control={control}
            name="billingStreet"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="billingStreet">{t('street')}</FormLabel>
                <FormControl>
                  <Input id="billingStreet" type="text" {...field} data-testid={billingTid('street')} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="sm:col-span-2">
          <FormField
            control={control}
            name="billingHouseNumber"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="billingHouseNumber">{tAddress('streetNumber')}</FormLabel>
                <FormControl>
                  <Input id="billingHouseNumber" type="text" {...field} data-testid={billingTid('streetNumber')} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
        <div className="sm:col-span-2">
          <FormField
            control={control}
            name="billingPostalCode"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="billingPostalCode">{t('postalCode')}</FormLabel>
                <FormControl>
                  <Input id="billingPostalCode" type="text" {...field} data-testid={billingTid('zipCode')} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="sm:col-span-5">
          <FormField
            control={control}
            name="billingCity"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="billingCity">{t('city')}</FormLabel>
                <FormControl>
                  <Input id="billingCity" type="text" {...field} data-testid={billingTid('city')} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>

      <FormField
        control={control}
        name="billingState"
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel htmlFor="billingState">{tAddress('state')}</FormLabel>
            <FormControl>
              <Input id="billingState" type="text" {...field} data-testid={billingTid('state')} />
            </FormControl>
            <div className="absolute top-full left-0 mt-0.5">
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="billingPhone"
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel htmlFor="billingPhone">{tAddress('phoneNumber')}</FormLabel>
            <FormControl>
              <Input id="billingPhone" type="text" {...field} data-testid={billingTid('phoneNumber')} />
            </FormControl>
            <div className="absolute top-full left-0 mt-0.5">
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="billingCountry"
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel htmlFor="billingCountry">{t('country')}</FormLabel>
            <FormControl>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  field.onBlur();
                }}
                value={field.value ?? ''}
              >
                <SelectTrigger id="billingCountry" data-testid={billingTid('country')}>
                  <SelectValue placeholder={t('country')} />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((country) => (
                    <SelectItem key={country.code} value={country.code} className="px-2">
                      {l10n(country.name) || country.code}
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
    </div>
  );
}

export function AddressInfoSection({ control, number }: AddressInfoAccordionProps) {
  const { loading, countries, fetchSiteData } = useSite();
  const { l10n } = useL10n();
  const locale = useLocale();
  const t = useTranslations('auth.register');
  const sortedCountries = useMemo(
    () => sortCountriesByDisplayName(countries ?? [], locale, l10n),
    [countries, locale, l10n],
  );

  // useWatch auf oberster Ebene der Komponente verwenden
  const businessType = useWatch({
    control,
    name: 'businessType',
  });
  const shippingSameAsBilling = useWatch({
    control,
    name: 'shippingSameAsBilling',
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
                    {sortedCountries.map((country) => (
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
        {!shippingSameAsBilling && <RegistrationBillingFields control={control} countries={sortedCountries} />}
      </div>
    </div>
  );
}
