'use client';

import { Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H2 } from '@/components/ui/h';
import { Separator } from '@/components/ui/separator';

interface EmailSignupSectionProps {
  control: Control<any>;
  number: number;
}

export function EmailSignupSection({ control, number }: EmailSignupSectionProps) {
  const t = useTranslations('auth.register');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H2 variant="h5">
          {number}. {t('emailSignup')}
        </H2>
        <Separator />
      </div>
      <div className="space-y-4">
        <FormField
          control={control}
          name="newsletter"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox id="newsletter" checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-medium" htmlFor="newsletter">
                {t('newsletter')}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="dealsAlerts"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox id="dealsAlerts" checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-medium" htmlFor="dealsAlerts">
                {t('dealsAlerts')}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
