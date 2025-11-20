'use client';

import React, { useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChatMessage as ChatMessageType } from './types';
import { ChatMessage } from './ChatMessage';
import { StructuredDataHandlers } from './types';
import { LoadingIndicator } from './LoadingIndicator';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  loading: boolean;
  handlers: StructuredDataHandlers;
  currency?: string;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, loading, handlers, currency = 'USD' }) => {
  const t = useTranslations('account.AiHelper');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // Use requestAnimationFrame for smoother scrolling
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
      className="flex-1 overflow-y-auto border rounded-lg p-3 bg-surface-image-background mb-3 scroll-smooth"
    >
      {messages.length === 0 ? (
        <div className="text-center text-text-placeholders py-8">{t('emptyState')}</div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} handlers={handlers} currency={currency} />
          ))}
          {loading && <LoadingIndicator />}
        </div>
      )}
    </div>
  );
};

