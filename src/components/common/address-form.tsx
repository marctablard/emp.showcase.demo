'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSite } from '@/hooks/site/useSite';
import { useValidator } from '@/hooks/validation/useValidator';
import { Address } from '@/platform/services/model/common';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Spinner } from '../ui/spinner';

interface AddressFormProps {
  initialData?: Address | null;
  onDataChange?: (data: Address) => void;
  isReadOnly?: boolean;
}

const emptyAddress = {
  contactName: '',
  street: '',
  streetNumber: '',
  streetAppendix: '',
  zipCode: '',
  city: '',
  country: '',
  state: '',
  companyName: '',
  contactPhone: '',
};

/**
 * Reusable address form component for checkout
 * Can be used for both shipping and billing addresses
 */
const AddressForm: React.FC<AddressFormProps> = ({ isReadOnly = false, initialData, onDataChange }) => {
  const t = useTranslations('account.AddressForm');
  const { form } = useValidator(
    'AddressValidationService',
    { ...emptyAddress, ...initialData },
    'onBlur',
    onDataChange,
  );
  useEffect(() => {
    if (initialData) {
      form.reset({ ...emptyAddress, ...initialData });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);
  const { countries, loading } = useSite();

  return (
    <Form {...form}>
      <div className="space-y-6">
        <div>
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="companyName">{t('companyName')}*</FormLabel>
                <FormControl>
                  <Input id="companyName" type="text" {...field} disabled={isReadOnly} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div>
          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="contactName">{t('fullName')}*</FormLabel>
                <FormControl>
                  <Input id="contactName" type="text" {...field} disabled={isReadOnly} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
          <div className="sm:col-span-5">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel htmlFor="street">{t('street')}*</FormLabel>
                  <FormControl>
                    <Input id="street" type="text" {...field} disabled={isReadOnly} />
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
              control={form.control}
              name="streetNumber"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel htmlFor="streetNumber">{t('streetNumber')}*</FormLabel>
                  <FormControl>
                    <Input id="streetNumber" type="text" {...field} disabled={isReadOnly} />
                  </FormControl>
                  <div className="absolute top-full left-0 mt-0.5">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-4 space-y-4">
          <div className="sm:col-span-2">
            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel htmlFor="zipCode">{t('zipCode')}*</FormLabel>
                  <FormControl>
                    <Input id="zipCode" type="text" {...field} disabled={isReadOnly} />
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
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel htmlFor="city">{t('city')}*</FormLabel>
                  <FormControl>
                    <Input id="city" type="text" {...field} disabled={isReadOnly} />
                  </FormControl>
                  <div className="absolute top-full left-0 mt-0.5">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div>
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="state">{t('state')}</FormLabel>
                <FormControl>
                  <Input id="state" type="text" {...field} disabled={isReadOnly} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel htmlFor="phoneNumber">{t('phoneNumber')}</FormLabel>
                <FormControl>
                  <Input id="phoneNumber" type="text" {...field} disabled={isReadOnly} />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>

        <div>
          {loading ? (
            <div className="flex justify-center p-2">
              <Spinner variant="sm" />
            </div>
          ) : countries && countries.length > 0 ? (
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>{t('country')}*</FormLabel>
                  <FormControl>
                    {/*trigger field change AND form validation */}
                    <Select
                      onValueChange={(e) => {
                        field.onChange(e);
                        field.onBlur();
                      }}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('country')} />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.code} value={country.code} className="px-2">
                            {typeof country.name === 'string'
                              ? country.name
                              : country.name.en || Object.values(country.name)[0]}
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
          ) : (
            <p>{t('noCountriesAvailable')}</p>
          )}
        </div>
      </div>
    </Form>
  );
};

export default AddressForm;
