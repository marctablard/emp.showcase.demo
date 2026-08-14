/**
 * Returns whether Showcase should call AI Service chat-stream instead of batch chat.
 * Off only when NEXT_AI_CHAT_STREAMING is the string `'false'`; unset and any other value stay on.
 */
export function isAiChatStreamingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NEXT_AI_CHAT_STREAMING === 'false') {
    return false;
  }
  return true;
}
