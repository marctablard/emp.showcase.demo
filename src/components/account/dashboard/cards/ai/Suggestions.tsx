'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface SuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
}

const SUGGESTION_BUTTON_CLASSES =
  'px-4 py-2.5 bg-surface-action text-text-on-action rounded-lg hover:bg-surface-action-hover transition-colors shadow-sm font-medium';

export const Suggestions: React.FC<SuggestionsProps> = ({ onSuggestionClick }) => {
  const t = useTranslations('account.AiHelper');

  const suggestions = [
    { key: 'openQuotes' as const },
    { key: 'showProfile' as const },
    { key: 'pendingOrders' as const },
  ];

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-wrap gap-3 justify-center">
        {suggestions.map((suggestion) => {
          const text = t(`suggestions.${suggestion.key}`);
          return (
            <button
              key={suggestion.key}
              type="button"
              className={SUGGESTION_BUTTON_CLASSES}
              onClick={() => onSuggestionClick(text)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
};
