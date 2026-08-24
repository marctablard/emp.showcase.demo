'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { StreamingPreview } from '@/hooks/ai/useAI';
import { ChatMessage } from './ChatMessage';
import { LoadingIndicator } from './LoadingIndicator';
import { ThinkingTranscript } from './ThinkingTranscript';
import type { ChatMessage as ChatMessageType } from './types';
import type { StructuredDataHandlers } from './types';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  loading: boolean;
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

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  loading,
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

  const showStreamingPreview = loading && streamingPreview !== null;
  const showThinking = loading && Boolean(streamingThinking);
  const showLoadingIndicator = loading && !showStreamingPreview && !showThinking;

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
          {showThinking && <ThinkingTranscript text={streamingThinking ?? ''} />}
          {showStreamingPreview && <ChatMessage message={toStreamingMessage(streamingPreview)} handlers={handlers} />}
          {showLoadingIndicator && <LoadingIndicator chunkCount={chunkCount} />}
        </div>
      )}
    </div>
  );
};
