'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export const LoadingIndicator: React.FC = () => {
  const t = useTranslations('account.AiHelper');

  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="bg-surface-primary border border-border-primary rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-border-action" aria-hidden="true"></div>
          <span className="text-base text-text-placeholders">{t('thinking')}</span>
        </div>
      </div>
      <span className="sr-only">{t('aiProcessing')}</span>
    </div>
  );
};
