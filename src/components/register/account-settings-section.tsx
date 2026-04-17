'use client';

import { useState } from 'react';
import type { Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H2 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { PasswordCriteria } from './password-criteria';

interface AccountSettingsAccordionProps {
  control: Control<any>;
  number: number;
}

export function AccountSettingsSection({ control, number }: AccountSettingsAccordionProps) {
  const t = useTranslations('auth.register');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H2 variant="h5">
          {number}. {t('accountSettings')}
        </H2>
        <Separator />
      </div>
      <div className="space-y-6">
        <FormField
          control={control}
          name="password"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="password">{t('password')}</FormLabel>
              <FormControl>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  endIcon={showPassword ? Eye : EyeOff}
                  onEndIconClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  required
                  data-testid="register-password"
                  {...field}
                />
              </FormControl>
              <PasswordCriteria control={control} passwordField="password" />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="passwordConfirmation"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel htmlFor="passwordConfirmation">{t('passwordConfirmation')}</FormLabel>
              <FormControl>
                <Input
                  id="passwordConfirmation"
                  type={showPasswordConfirmation ? 'text' : 'password'}
                  endIcon={showPasswordConfirmation ? Eye : EyeOff}
                  onEndIconClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                  endIconLabel={showPasswordConfirmation ? t('hidePassword') : t('showPassword')}
                  required
                  data-testid="register-passwordConfirmation"
                  {...field}
                />
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
