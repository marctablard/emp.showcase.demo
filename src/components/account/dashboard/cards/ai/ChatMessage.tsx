'use client';

import React, { useEffect } from 'react';
import { hasResolvedWidgetPayload } from '@/lib/common/ai-tool-widgets';
import { cn } from '@/lib/utils';
import { StructuredDataRenderer } from './StructuredDataRenderer';
import type { ChatMessage as ChatMessageType } from './types';
import type { StructuredDataHandlers } from './types';
import { formatTimestamp } from './utils';
import {
  UNRECOGNIZED_RESPONSE_TYPE,
  buildUnrecognizedResponseData,
  logUnrecognizedAiResponse,
  looksLikeStructuredCaption,
  resolveUnrecognizedLogSource,
  shopperCaptionFromRaw,
} from './utils/unrecognized-response';

interface ChatMessageProps {
  message: ChatMessageType;
  handlers: StructuredDataHandlers;
  streaming?: boolean;
}

const getNestedText = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return undefined;
  }

  const nested = (data as { message?: unknown }).message;
  return typeof nested === 'string' && nested !== '' ? nested : undefined;
};

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

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, handlers, streaming = false }) => {
  const isUser = message.isUser;
  const leakedJson = !isUser && looksLikeStructuredCaption(message.content);
  const sourceHasResolvedWidget = Boolean(
    message.type && message.type !== 'text' && hasResolvedWidgetPayload(message.type, message.data),
  );
  const recoverLeakedJson = leakedJson && !sourceHasResolvedWidget;
  const displayContent = leakedJson ? shopperCaptionFromRaw(message.content) : message.content;
  const displayType = recoverLeakedJson ? UNRECOGNIZED_RESPONSE_TYPE : message.type;
  const displayData = recoverLeakedJson ? buildUnrecognizedResponseData(message.content, message.data) : message.data;

  useEffect(() => {
    if (!recoverLeakedJson) {
      return;
    }
    logUnrecognizedAiResponse(resolveUnrecognizedLogSource(message.content, message.data));
  }, [recoverLeakedJson, message.content, message.data]);

  const dataMessage = getNestedText(displayData);
  const hasStructuredData = Boolean(displayData && displayType && displayType !== 'text');
  const textBody =
    !isUser && displayType === 'text' && dataMessage && dataMessage !== displayContent ? dataMessage : undefined;
  const shouldShowContent = Boolean(displayContent) && (!hasStructuredData || displayContent !== dataMessage);

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={getMessageContainerClasses(isUser, hasStructuredData)}>
        {hasStructuredData && (
          <div className={cn('w-full max-w-none', (shouldShowContent || Boolean(textBody)) && 'mb-2')}>
            <StructuredDataRenderer type={displayType!} data={displayData} handlers={handlers} streaming={streaming} />
          </div>
        )}

        {shouldShowContent && (
          <div
            className={cn(
              'text-base whitespace-pre-wrap font-medium',
              isUser ? 'text-text-on-action' : 'text-text-headings',
            )}
          >
            {displayContent}
          </div>
        )}

        {textBody && (
          <div
            className={cn(
              'text-base whitespace-pre-wrap text-text-body',
              (shouldShowContent || hasStructuredData) && 'mt-1',
            )}
          >
            {textBody}
          </div>
        )}

        <div className={cn('text-[10px] mt-0.5 opacity-70', isUser ? 'text-text-on-action' : 'text-text-placeholders')}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
