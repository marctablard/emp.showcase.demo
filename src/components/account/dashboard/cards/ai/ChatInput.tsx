'use client';

import React from 'react';
import { FormProvider } from 'react-hook-form';
import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { InputButton } from '@/components/ui/input';
import { AiHelperFormData } from './types';

interface ChatInputProps {
  form: UseFormReturn<AiHelperFormData>;
  onSubmit: (data: AiHelperFormData) => void;
  loading: boolean;
  isChatMode: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ form, onSubmit, loading, isChatMode }) => {
  const t = useTranslations('account.AiHelper');

  const placeholder = isChatMode ? t('chatPlaceholder') : t('placeholder');
  const buttonText = loading ? t('sending') : isChatMode ? t('sendButton') : t('buttonText');

  return (
    <div className="bg-white border-t border-gray-200 pt-4 pb-4">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputButton placeholder={placeholder} buttonText={buttonText} disabled={loading} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </FormProvider>
    </div>
  );
};
