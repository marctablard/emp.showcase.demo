'use client';

import React, { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { InputButton } from '@/components/ui/input';
import type { AiHelperFormData } from './types';

interface ChatInputProps {
  form: UseFormReturn<AiHelperFormData>;
  onSubmit: (data: AiHelperFormData) => void;
  loading: boolean;
  isChatMode: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ form, onSubmit, loading, isChatMode }) => {
  const t = useTranslations('account.AiHelper');
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLoadingRef = useRef(loading);

  const placeholder = isChatMode ? t('chatPlaceholder') : t('placeholder');
  const buttonText = loading ? t('sending') : isChatMode ? t('sendButton') : t('buttonText');

  // Auto-focus input when loading completes
  useEffect(() => {
    if (prevLoadingRef.current && !loading && inputRef.current) {
      inputRef.current.focus();
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  return (
    <div className="bg-white border-t border-gray-200 pt-4 pb-4">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="question"
            render={({ field: { ref: fieldRef, ...field } }) => (
              <FormItem>
                <FormControl>
                  <InputButton
                    ref={(element) => {
                      // Set internal ref for focus management
                      inputRef.current = element;
                      // Set react-hook-form ref for form tracking
                      if (typeof fieldRef === 'function') {
                        fieldRef(element);
                      }
                    }}
                    placeholder={placeholder}
                    buttonText={buttonText}
                    disabled={loading}
                    aria-label={placeholder}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </FormProvider>
    </div>
  );
};
