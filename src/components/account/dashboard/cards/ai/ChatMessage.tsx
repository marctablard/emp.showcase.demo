'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { StructuredDataRenderer } from './StructuredDataRenderer';
import { ChatMessage as ChatMessageType } from './types';
import { StructuredDataHandlers } from './types';
import { formatTimestamp } from './utils';

interface ChatMessageProps {
  message: ChatMessageType;
  handlers: StructuredDataHandlers;
}

const getMessageContainerClasses = (isUser: boolean, hasStructuredData: boolean): string => {
  const baseClasses = 'rounded-lg px-3 py-1.5 shadow-sm';

  if (isUser) {
    return cn(
      baseClasses,
      'bg-surface-action text-text-on-action max-w-[80%] hover:bg-surface-action-hover transition-colors',
    );
  }

  const aiBaseClasses = 'bg-surface-primary border border-border-primary';
  if (hasStructuredData) {
    return cn(baseClasses, aiBaseClasses, 'w-full max-w-none');
  }

  return cn(baseClasses, aiBaseClasses, 'max-w-[80%]');
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, handlers }) => {
  const isUser = message.isUser;
  const hasStructuredData = Boolean(message.data && message.type && message.type !== 'text');

  // Check if content duplicates the data message (to avoid showing twice)
  const dataMessage =
    message.data && typeof message.data === 'object' && 'message' in message.data
      ? (message.data as { message?: string }).message
      : undefined;
  const shouldShowContent = !hasStructuredData || message.content !== dataMessage;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={getMessageContainerClasses(isUser, hasStructuredData)}>
        {shouldShowContent && (
          <div
            className={cn(
              'text-base whitespace-pre-wrap font-medium',
              isUser ? 'text-text-on-action' : 'text-text-headings',
            )}
          >
            {message.content}
          </div>
        )}

        {hasStructuredData && (
          <div className={cn('w-full max-w-none', shouldShowContent && 'mt-2')}>
            <StructuredDataRenderer type={message.type!} data={message.data} handlers={handlers} />
          </div>
        )}

        <div className={cn('text-[10px] mt-0.5 opacity-70', isUser ? 'text-text-on-action' : 'text-text-placeholders')}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
