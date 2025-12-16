'use client';

import { useCallback } from 'react';
import { ChatMessage } from '@/components/account/dashboard/cards/ai/types';
import { usePersistedState } from '../common/usePersistedState';

const MESSAGES_KEY = 'ai-helper-chat-messages';
const CHAT_MODE_KEY = 'ai-helper-chat-mode';
const SESSION_ID_KEY = 'ai-session-id';

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
  const [messages, setMessages, clearMessages] = usePersistedState<ChatMessage[]>({
    key: MESSAGES_KEY,
    defaultValue: [],
    deserialize: deserializeMessages,
  });

  const [isChatMode, setIsChatMode, resetChatMode] = usePersistedState<boolean>({
    key: CHAT_MODE_KEY,
    defaultValue: false,
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_ID_KEY, crypto.randomUUID());
    }
  }, [clearMessages, resetChatMode]);

  return {
    messages,
    setMessages,
    addMessage,
    isChatMode,
    setIsChatMode,
    clearChat,
  };
}
