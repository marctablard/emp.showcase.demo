'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { StreamingPreview } from '@/hooks/ai/useAI';
import { cn } from '@/lib/utils';
import { ChatMessage } from './ChatMessage';
import { LoadingIndicator } from './LoadingIndicator';
import type { ChatMessage as ChatMessageType } from './types';
import type { StructuredDataHandlers } from './types';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  loading: boolean;
  processing?: boolean;
  chunkCount?: number | null;
  streamingPreview?: StreamingPreview | null;
  streamingThinking?: string | null;
  handlers: StructuredDataHandlers;
}

const streamingPreviewKey = (preview: StreamingPreview | null | undefined): string | null => {
  if (!preview) {
    return null;
  }
  if (preview.kind === 'text') {
    return preview.content;
  }
  if (preview.kind === 'html') {
    return preview.html;
  }
  return `${preview.type}:${JSON.stringify(preview.data)}`;
};

const toStreamingMessage = (preview: StreamingPreview): ChatMessageType => {
  if (preview.kind === 'html') {
    return {
      id: 'streaming-preview',
      content: '',
      isUser: false,
      timestamp: new Date(),
      type: 'html',
      data: { html: preview.html },
    };
  }

  if (preview.kind === 'widget') {
    return {
      id: 'streaming-preview',
      content: preview.message,
      isUser: false,
      timestamp: new Date(),
      type: preview.type,
      data: preview.data,
    };
  }

  return {
    id: 'streaming-preview',
    content: preview.content,
    isUser: false,
    timestamp: new Date(),
    type: 'text',
  };
};

const previewHandlers: StructuredDataHandlers = {
  setQuestionValue: () => {},
  handleQuestionSubmit: () => {},
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  loading,
  processing = false,
  chunkCount = null,
  streamingPreview = null,
  streamingThinking = null,
  handlers,
}) => {
  const t = useTranslations('account.AiHelper');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewKey = streamingPreviewKey(streamingPreview);

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
  }, [messages.length, loading, previewKey, streamingThinking]);

  const showStreamingPreview =
    streamingPreview != null && (loading || messages.length === 0 || Boolean(messages.at(-1)?.isUser));
  const showLoadingIndicator = loading;
  const showEmptyState = messages.length === 0 && !showStreamingPreview && !showLoadingIndicator;
  const isBusy = loading || processing;

  return (
    <div
      ref={scrollContainerRef}
      role="log"
      aria-live="polite"
      aria-busy={isBusy}
      aria-label={t('chatHistory')}
      aria-relevant="additions"
      className={cn(
        'flex-1 overflow-y-auto border rounded-lg p-3 bg-surface-image-background mb-3 scroll-smooth',
        isBusy && 'cursor-progress',
      )}
    >
      {showEmptyState ? (
        <div className="text-center text-text-placeholders py-8">{t('emptyState')}</div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} handlers={handlers} />
          ))}
          {showLoadingIndicator && <LoadingIndicator chunkCount={chunkCount} />}
          {showStreamingPreview && (
            <ChatMessage message={toStreamingMessage(streamingPreview)} handlers={previewHandlers} />
          )}
        </div>
      )}
    </div>
  );
};
