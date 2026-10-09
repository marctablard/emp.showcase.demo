'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ErrorData, StructuredDataHandlers } from '../types';

interface ErrorRendererProps {
  data: ErrorData;
  setQuestionValue: StructuredDataHandlers['setQuestionValue'];
  handleQuestionSubmit: StructuredDataHandlers['handleQuestionSubmit'];
}

export const ErrorRenderer: React.FC<ErrorRendererProps> = ({ data, setQuestionValue, handleQuestionSubmit }) => {
  const t = useTranslations('account.AiHelper');

  const handleRetry = () => {
    const retryMessage = t('pleaseTryAgain');
    setQuestionValue(retryMessage);
    requestAnimationFrame(() => {
      handleQuestionSubmit({ question: retryMessage });
    });
  };

  return (
    <div className="flex items-start gap-3 border-l-2 border-border-error bg-surface-error px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-text-error" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-text-error">{data.errorCode || t('error')}</p>
        <p className="text-text-body">{data.message}</p>
        {data.details ? <p className="text-xs text-text-placeholders">{data.details}</p> : null}
        {data.canRetry ? (
          <Button
            type="button"
            variant="outlineError"
            size="small"
            className="mt-1 h-7 px-3 text-xs"
            onClick={handleRetry}
            data-testid="aiError-retryButton"
          >
            {t('retry')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
