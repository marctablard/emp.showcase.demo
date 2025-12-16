'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorData, StructuredDataHandlers } from '../types';

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
    <div className="p-4 bg-surface-error border border-border-error rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-6 h-6 bg-surface-error rounded-full flex items-center justify-center">
            <span className="text-text-error text-sm">⚠️</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-text-error text-base mb-1">{data.errorCode || t('error')}</div>
          <div className="text-text-error text-sm mb-2">{data.message}</div>
          {data.details && <div className="text-text-error text-sm mb-3">{data.details}</div>}
          {data.canRetry && (
            <button
              onClick={handleRetry}
              className="px-3 py-1 bg-surface-error text-text-error text-sm rounded hover:bg-surface-error/80 transition-colors"
            >
              {t('retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
