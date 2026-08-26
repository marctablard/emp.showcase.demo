'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { type UnrecognizedResponseData, firstJsonPreviewLines } from './utils/unrecognized-response';

interface UnrecognizedResponseFallbackProps {
  data?: unknown;
}

const previewFromData = (data: unknown): string => {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'previewJson' in data) {
    const previewJson = (data as UnrecognizedResponseData).previewJson;
    if (typeof previewJson === 'string' && previewJson !== '') {
      return previewJson;
    }
  }
  return firstJsonPreviewLines(data);
};

export const UnrecognizedResponseFallback: React.FC<UnrecognizedResponseFallbackProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const previewJson = previewFromData(data);

  return (
    <div className="space-y-2">
      {previewJson ? (
        <pre className="text-xs text-text-placeholders whitespace-pre-wrap break-all rounded border border-border-primary bg-surface-page p-2">
          {previewJson}
        </pre>
      ) : null}
      <p className="text-sm text-text-body">{t('unrecognizedResponseHint')}</p>
    </div>
  );
};
