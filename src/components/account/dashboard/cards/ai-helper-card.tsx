'use client';

import React, { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import AiStarsIcon from '@/components/icons/ai-stars';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { useAI } from '@/hooks/ai/useAI';
import { useChatMessages } from '@/hooks/ai/useChatMessages';
import { useCart } from '@/hooks/cart/useCart';
import { useRateLimit } from '@/hooks/common/useRateLimit';
import { useSession } from '@/hooks/session/useSession';
import { useValidator } from '@/hooks/validation/useValidator';
import { prepareAIContext } from '@/lib/client/ai';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/providers/StoreProvider';
import { ChatInput } from './ai/ChatInput';
import { ChatMessages } from './ai/ChatMessages';
import { Suggestions } from './ai/Suggestions';
import type { AiHelperFormData, ChatMessage as ChatMessageType, StructuredDataHandlers } from './ai/types';
import { parseAIResponse } from './ai/utils/response-parser';
import { sanitizeUserInput } from './ai/utils/sanitize';
import type { DashboardCardProps } from './dashboard-card';

function AiHelperCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account.AiHelper');
  const { form } = useValidator('AiHelperValidationService', { question: '' });

  const { sendMessageWithContext, loading, error } = useAI();
  const { session } = useSession();
  const { refetch: refetchCart } = useCart();
  const cartStore = useCartStore();
  const { checkRateLimit } = useRateLimit({ maxRequests: 10, windowMs: 60000 });

  // Use the chat messages hook for persistence
  const { messages, setMessages, isChatMode, setIsChatMode, clearChat } = useChatMessages();

  const handleQuestionSubmit = useCallback(
    async (data: AiHelperFormData) => {
      // Sanitize user input
      const { sanitized, error: sanitizeError } = sanitizeUserInput(data.question);
      if (sanitizeError || !sanitized || !session) return;

      // Check rate limit
      if (!checkRateLimit()) {
        const rateLimitMessage: ChatMessageType = {
          id: Date.now().toString(),
          content: t('rateLimitExceeded'),
          isUser: false,
          timestamp: new Date(),
          type: 'error',
        };
        setMessages((prev) => [...prev, rateLimitMessage]);
        setIsChatMode(true);
        return;
      }

      const userMessage: ChatMessageType = {
        id: Date.now().toString(),
        content: sanitized,
        isUser: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsChatMode(true);

      try {
        const context = await prepareAIContext(session, cartStore);
        const aiResponse = await sendMessageWithContext(sanitized, context);

        const parsed = parseAIResponse(aiResponse.message);
        const cartRefresh = parsed.cartRefresh || aiResponse.cartRefresh || false;

        const aiMessage: ChatMessageType = {
          id: (Date.now() + 1).toString(),
          content: parsed.message,
          isUser: false,
          timestamp: new Date(),
          data: parsed.data,
          type: parsed.type,
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (cartRefresh) {
          await refetchCart();
        }
      } catch (_err) {
        const errorMessage: ChatMessageType = {
          id: (Date.now() + 1).toString(),
          content: t('errorOccurred'),
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }

      form.reset();
    },
    [session, cartStore, sendMessageWithContext, refetchCart, checkRateLimit, t, form, setMessages, setIsChatMode],
  );

  const setQuestionValue = useCallback(
    (question: string) => {
      form.setValue('question', question);
    },
    [form],
  );

  const handlers: StructuredDataHandlers = useMemo(
    () => ({
      setQuestionValue,
      handleQuestionSubmit,
    }),
    [setQuestionValue, handleQuestionSubmit],
  );

  return (
    <div
      className={cn('flex flex-col h-96 bg-white rounded-xl border shadow-sm overflow-hidden', className)}
      {...props}
    >
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AiStarsIcon className="flex-shrink-0" />
            <CardTitle className="text-4xl font-bold">{title || t('title')}</CardTitle>
          </div>
          {isChatMode && (
            <Button variant="secondary" size="small" onClick={clearChat} className="text-sm">
              {t('clearChat')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4">
        {isChatMode && <ChatMessages messages={messages} loading={loading} handlers={handlers} />}

        {!isChatMode && <Suggestions onSuggestionClick={setQuestionValue} />}
        <ChatInput form={form} onSubmit={handleQuestionSubmit} loading={loading} isChatMode={isChatMode} />
      </div>

      {error && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 text-sm">Error: {error.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AiHelperCard };
