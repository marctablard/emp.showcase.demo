/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiHelperCard } from './ai-helper-card';

const toast = jest.fn();
const sendMessageWithContext = jest.fn();
const checkRateLimit = jest.fn(() => true);
const setMessages = jest.fn();
const setIsChatMode = jest.fn();
const formReset = jest.fn();
const loggerError = jest.fn();

let mockLoading = false;
let mockError: Error | null = null;
let mockIsChatMode = false;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ toast }),
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({
    error: loggerError,
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/hooks/ai/useAI', () => ({
  useAI: () => ({
    sendMessageWithContext,
    loading: mockLoading,
    chunkCount: null,
    error: mockError,
  }),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => ({
    session: { id: 'session-1', site: 'main', currency: 'EUR', language: 'en' },
  }),
}));

jest.mock('@/hooks/cart/useCart', () => ({
  useCart: () => ({
    refetch: jest.fn(),
  }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useCartStore: () => ({}),
}));

jest.mock('@/hooks/common/useRateLimit', () => ({
  useRateLimit: () => ({
    checkRateLimit,
  }),
}));

jest.mock('@/hooks/ai/useChatMessages', () => ({
  useChatMessages: () => ({
    messages: [],
    setMessages,
    isChatMode: mockIsChatMode,
    setIsChatMode,
    clearChat: jest.fn(),
  }),
}));

jest.mock('@/hooks/validation/useValidator', () => ({
  useValidator: () => ({
    form: {
      reset: formReset,
      setValue: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/client/ai', () => ({
  prepareAIContext: jest.fn().mockResolvedValue({ siteId: 'main', currency: 'EUR', language: 'en' }),
}));

jest.mock('./ai/ChatInput', () => ({
  ChatInput: ({ onSubmit, loading }: { onSubmit: (data: { question: string }) => void; loading: boolean }) => (
    <div>
      <button type="button" onClick={() => onSubmit({ question: 'What are my orders?' })}>
        submit-question
      </button>
      <input aria-label="chat-input" disabled={loading} />
    </div>
  ),
}));

jest.mock('./ai/ChatMessages', () => ({
  ChatMessages: ({ loading }: { loading: boolean }) => (
    <div data-testid="chat-messages">{loading ? 'thinking' : 'idle'}</div>
  ),
}));

jest.mock('./ai/Suggestions', () => ({
  Suggestions: () => <div data-testid="suggestions">suggestions</div>,
}));

describe('AiHelperCard', () => {
  beforeEach(() => {
    toast.mockReset();
    sendMessageWithContext.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockReturnValue(true);
    setMessages.mockReset();
    setIsChatMode.mockReset();
    formReset.mockReset();
    loggerError.mockReset();
    mockLoading = false;
    mockError = null;
    mockIsChatMode = false;
  });

  it('shows a toast and an AI error chat message, and no inline red error box, when chat fails', async () => {
    sendMessageWithContext.mockRejectedValue(new Error('AI service request failed: 500 Internal Server Error'));

    const { container } = render(<AiHelperCard />);

    fireEvent.click(screen.getByRole('button', { name: 'submit-question' }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'error',
        description: 'errorOccurred',
        variant: 'destructive',
      });
    });

    expect(container.querySelector('.bg-red-50')).not.toBeInTheDocument();
    expect(screen.queryByText(/AI service request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
    expect(setMessages).toHaveBeenCalledTimes(2);

    const userMessageUpdater = setMessages.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    expect(userMessageUpdater([])).toEqual([
      expect.objectContaining({
        content: 'What are my orders?',
        isUser: true,
      }),
    ]);

    const errorMessageUpdater = setMessages.mock.calls[1][0] as (prev: unknown[]) => unknown[];
    expect(errorMessageUpdater([{ id: 'user-message' }])).toEqual([
      { id: 'user-message' },
      expect.objectContaining({
        content: 'errorOccurred',
        isUser: false,
        type: 'error',
      }),
    ]);

    expect(screen.getByLabelText('chat-input')).not.toBeDisabled();
  });

  it('keeps the card usable and does not render the inline error when useAI exposes an error', () => {
    mockError = new Error('AI service request failed: 500 Internal Server Error');
    mockIsChatMode = true;
    mockLoading = false;

    const { container } = render(<AiHelperCard />);

    expect(container.querySelector('.bg-red-50')).not.toBeInTheDocument();
    expect(screen.queryByText(/AI service request failed/)).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-messages')).toHaveTextContent('idle');
    expect(screen.getByLabelText('chat-input')).not.toBeDisabled();
  });
});
