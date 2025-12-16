'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatMessage } from './ChatMessage';
import { LoadingIndicator } from './LoadingIndicator';
import { ChatMessage as ChatMessageType } from './types';
import { StructuredDataHandlers } from './types';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  loading: boolean;
  handlers: StructuredDataHandlers;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, loading, handlers }) => {
  const t = useTranslations('account.AiHelper');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [messages.length, loading]);

  return (
    <div
      ref={scrollContainerRef}
      role="log"
      aria-live="polite"
      aria-label={t('chatHistory')}
      aria-relevant="additions"
      className="flex-1 overflow-y-auto border rounded-lg p-3 bg-surface-image-background mb-3 scroll-smooth"
    >
      {messages.length === 0 ? (
        <div className="text-center text-text-placeholders py-8">{t('emptyState')}</div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} handlers={handlers} />
          ))}
          {loading && <LoadingIndicator />}
        </div>
      )}
    </div>
  );
};
