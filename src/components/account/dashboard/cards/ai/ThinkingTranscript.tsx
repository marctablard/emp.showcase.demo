'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ThinkingTranscriptProps {
  text: string;
}

export const ThinkingTranscript: React.FC<ThinkingTranscriptProps> = ({ text }) => {
  const t = useTranslations('account.AiHelper');

  if (!text) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border-primary bg-surface-primary px-3 py-2">
      <summary className="cursor-pointer text-sm text-text-placeholders">{t('thinking')}</summary>
      <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-text-body">{text}</pre>
    </details>
  );
};
