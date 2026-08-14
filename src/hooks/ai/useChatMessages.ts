'use client';

import { useCallback, useLayoutEffect } from 'react';
import type { ChatMessage } from '@/components/account/dashboard/cards/ai/types';
import {
  adoptAIHelperStorage,
  aiHelperStorageKeys,
  isAIHelperStorageOwnerId,
  rotateAIHelperSessionId,
} from '@/lib/client/ai-helper-storage';
import { usePersistedState } from '../common/usePersistedState';
import { useSession } from '../session/useSession';

/**
 * Deserialize chat messages from JSON, converting timestamp strings to Date objects
 */
const deserializeMessages = (json: string): ChatMessage[] => {
  const parsed = JSON.parse(json);
  return parsed.map((msg: ChatMessage & { timestamp: string }) => ({
    ...msg,
    timestamp: new Date(msg.timestamp),
  }));
};

/**
 * Hook for managing AI chat messages with persistence
 */
export function useChatMessages() {
  const { session } = useSession();
  const ownerId = isAIHelperStorageOwnerId(session?.customerId) ? session.customerId : undefined;

  useLayoutEffect(() => {
    if (ownerId) {
      adoptAIHelperStorage(ownerId);
    }
  }, [ownerId]);

  const storageKeys = ownerId ? aiHelperStorageKeys(ownerId) : aiHelperStorageKeys('pending');
  const persistEnabled = Boolean(ownerId);

  const [messages, setMessages, clearMessages] = usePersistedState<ChatMessage[]>({
    key: storageKeys.messages,
    defaultValue: [],
    deserialize: deserializeMessages,
    enabled: persistEnabled,
  });

  const [isChatMode, setIsChatMode, resetChatMode] = usePersistedState<boolean>({
    key: storageKeys.chatMode,
    defaultValue: false,
    enabled: persistEnabled,
  });

  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    },
    [setMessages],
  );

  const clearChat = useCallback(() => {
    clearMessages();
    resetChatMode();
    rotateAIHelperSessionId(ownerId);
  }, [clearMessages, ownerId, resetChatMode]);

  return {
    messages,
    setMessages,
    addMessage,
    isChatMode,
    setIsChatMode,
    clearChat,
  };
}
