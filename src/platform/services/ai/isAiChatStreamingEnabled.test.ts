import { isAiChatStreamingEnabled } from './isAiChatStreamingEnabled';

describe('isAiChatStreamingEnabled', () => {
  const original = process.env.NEXT_AI_CHAT_STREAMING;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_AI_CHAT_STREAMING;
    } else {
      process.env.NEXT_AI_CHAT_STREAMING = original;
    }
  });

  it('enables streaming when NEXT_AI_CHAT_STREAMING is unset', () => {
    delete process.env.NEXT_AI_CHAT_STREAMING;

    expect(isAiChatStreamingEnabled()).toBe(true);
  });

  it("enables streaming when NEXT_AI_CHAT_STREAMING is 'true'", () => {
    process.env.NEXT_AI_CHAT_STREAMING = 'true';

    expect(isAiChatStreamingEnabled()).toBe(true);
  });

  it("disables streaming only when NEXT_AI_CHAT_STREAMING is 'false'", () => {
    process.env.NEXT_AI_CHAT_STREAMING = 'false';

    expect(isAiChatStreamingEnabled()).toBe(false);
  });

  it('enables streaming for unrelated values', () => {
    process.env.NEXT_AI_CHAT_STREAMING = '0';
    expect(isAiChatStreamingEnabled()).toBe(true);

    process.env.NEXT_AI_CHAT_STREAMING = 'TRUE';
    expect(isAiChatStreamingEnabled()).toBe(true);

    process.env.NEXT_AI_CHAT_STREAMING = '';
    expect(isAiChatStreamingEnabled()).toBe(true);
  });
});
