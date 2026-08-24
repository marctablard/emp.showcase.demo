'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface LoadingIndicatorProps {
  chunkCount?: number | null;
  statusMessage?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ chunkCount = null, statusMessage }) => {
  const t = useTranslations('account.AiHelper');
  const label = statusMessage
    ? statusMessage
    : chunkCount === null
      ? t('thinking')
      : t('thinkingWithChunks', { numberOfChunks: chunkCount });

  return (
    <div className="flex justify-start">
      <div className="bg-surface-primary border border-border-primary rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-border-action" aria-hidden="true"></div>
          <span className="text-base text-text-placeholders" aria-hidden="true">
            {label}
          </span>
        </div>
      </div>
      <output className="sr-only">{t('aiProcessing')}</output>
    </div>
  );
};
