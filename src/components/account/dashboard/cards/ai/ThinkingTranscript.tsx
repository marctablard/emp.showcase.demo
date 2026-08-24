'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ThinkingTranscriptProps {
  /** Presence flag only — never render raw model chain-of-thought. */
  text: string;
}

export const ThinkingTranscript: React.FC<ThinkingTranscriptProps> = ({ text }) => {
  const t = useTranslations('account.AiHelper');

  if (!text) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-placeholders"
      role="status"
      aria-live="polite"
    >
      {t('thinking')}
    </div>
  );
};
