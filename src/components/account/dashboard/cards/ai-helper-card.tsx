'use client';

import React, { useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import AiStarsIcon from '@/components/icons/ai-stars';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { useAI } from '@/hooks/ai/useAI';
import { useChatMessages } from '@/hooks/ai/useChatMessages';
import { useCart } from '@/hooks/cart/useCart';
import { useLogger } from '@/hooks/common/useLogger';
import { useRateLimit } from '@/hooks/common/useRateLimit';
import { useSession } from '@/hooks/session/useSession';
import { useToast } from '@/hooks/ui/useToast';
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
  const locale = useLocale();
  const { form } = useValidator('AiHelperValidationService', { question: '' });
  const { toast } = useToast();
  const logger = useLogger();

  const { sendMessageWithContext, loading, chunkCount, streamingPreview, streamingThinking } = useAI();
  const { session } = useSession();
  const { refetch: refetchCart } = useCart();
  const cartStore = useCartStore();
  const { checkRateLimit } = useRateLimit({ maxRequests: 10, windowMs: 60000 });

  const { messages, setMessages, isChatMode, setIsChatMode, clearChat } = useChatMessages();

  const handleQuestionSubmit = useCallback(
    async (data: AiHelperFormData) => {
      const { sanitized, error: sanitizeError } = sanitizeUserInput(data.question);
      if (sanitizeError || !sanitized || !session) return;

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
        const context = await prepareAIContext(session, cartStore, locale);
        let cartRefresh = false;
        await sendMessageWithContext(sanitized, context, (aiResponse) => {
          const parsed = parseAIResponse(aiResponse.message);
          cartRefresh = Boolean(parsed.cartRefresh || aiResponse.cartRefresh || parsed.type === 'cart_summary');
          const aiMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            content: parsed.message,
            isUser: false,
            timestamp: new Date(),
            data: parsed.data,
            type: parsed.type,
          };
          setMessages((prev) => [...prev, aiMessage]);
        });

        if (cartRefresh) {
          await refetchCart();
        }
      } catch (err) {
        logger.error({ err }, 'AI Helper chat request failed');
        const errorMessage: ChatMessageType = {
          id: (Date.now() + 1).toString(),
          content: t('errorOccurred'),
          isUser: false,
          timestamp: new Date(),
          type: 'error',
        };
        setMessages((prev) => [...prev, errorMessage]);
        toast({
          title: t('error'),
          description: t('errorOccurred'),
          variant: 'destructive',
        });
      }

      form.reset();
    },
    [
      session,
      cartStore,
      sendMessageWithContext,
      refetchCart,
      checkRateLimit,
      t,
      form,
      setMessages,
      setIsChatMode,
      logger,
      toast,
      locale,
    ],
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
      className={cn('flex flex-col h-96 bg-surface-page rounded-xl border shadow-sm overflow-hidden', className)}
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
        {isChatMode && (
          <ChatMessages
            messages={messages}
            loading={loading}
            chunkCount={chunkCount}
            streamingPreview={streamingPreview}
            streamingThinking={streamingThinking}
            handlers={handlers}
          />
        )}

        {!isChatMode && <Suggestions onSuggestionClick={setQuestionValue} />}
        <ChatInput form={form} onSubmit={handleQuestionSubmit} loading={loading} isChatMode={isChatMode} />
      </div>
    </div>
  );
}

export { AiHelperCard };
