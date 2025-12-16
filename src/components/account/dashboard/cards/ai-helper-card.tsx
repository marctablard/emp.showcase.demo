'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import AiStarsIcon from '@/components/icons/ai-stars';
import { CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { H4 } from '@/components/ui/h';
import { InputButton } from '@/components/ui/input';
import { useValidator } from '@/hooks/validation/useValidator';
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardProps } from './dashboard-card';

type AiHelperFormData = {
  question: string;
};

/**
 * AI Helper Card component
 * Shows AI-assisted helper prompts for common questions
 */
function AiHelperCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account.AiHelper');
  const { form } = useValidator('AiHelperValidationService', {
    question: '',
  });

  const handleQuestionSubmit = (data: AiHelperFormData) => {
    console.log('Question submitted:', data.question);
    // Process the AI question here
    form.reset();
  };

  const setQuestionValue = (question: string) => {
    form.setValue('question', question);
  };

  return (
    <DashboardCard variant="default" className={cn('', className)} {...props}>
      <div className="flex items-center gap-3 mb-4">
        <AiStarsIcon className="flex-shrink-0" />
        <CardTitle>
          <H4 className="bg-clip-text text-transparent bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start">
            {title || t('title')}
          </H4>
        </CardTitle>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleQuestionSubmit)} className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-left px-3 py-2 bg-surface-disabled rounded-md hover:bg-surface-disabled-selected transition-colors inline-block"
              onClick={() => setQuestionValue(t('suggestions.openInvoices'))}
            >
              <span className="text-base font-medium">{t('suggestions.openInvoices')}</span>
            </button>
            <button
              type="button"
              className="text-left px-3 py-2 bg-surface-disabled rounded-md hover:bg-surface-disabled-selected transition-colors inline-block"
              onClick={() => setQuestionValue(t('suggestions.availableOffers'))}
            >
              <span className="text-base font-medium">{t('suggestions.availableOffers')}</span>
            </button>
            <button
              type="button"
              className="text-left px-3 py-2 bg-surface-disabled rounded-md hover:bg-surface-disabled-selected transition-colors inline-block"
              onClick={() => setQuestionValue(t('suggestions.recentPurchases'))}
            >
              <span className="text-base font-medium">{t('suggestions.recentPurchases')}</span>
            </button>
          </div>
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormControl>
                  <InputButton placeholder={t('placeholder')} buttonText={t('buttonText')} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </DashboardCard>
  );
}

export { AiHelperCard };
