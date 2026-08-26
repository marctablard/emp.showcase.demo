/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ChatMessages } from './ChatMessages';
import type { StructuredDataHandlers } from './types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('./ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { content: string; type?: string } }) => (
    <div data-testid="chat-message">{message.type === 'html' ? 'html-preview' : message.content}</div>
  ),
}));

jest.mock('./LoadingIndicator', () => ({
  LoadingIndicator: ({ chunkCount }: { chunkCount?: number | null }) => (
    <div data-testid="loading-indicator">{chunkCount && chunkCount > 0 ? `loading-${chunkCount}` : 'loading'}</div>
  ),
}));

const handlers: StructuredDataHandlers = {
  setQuestionValue: jest.fn(),
  handleQuestionSubmit: jest.fn(),
};

describe('ChatMessages', () => {
  it('keeps the thinking indicator with a live chunk count while a preview streams', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Question', isUser: true, timestamp: new Date() }]}
        loading
        chunkCount={4}
        streamingPreview={{ kind: 'text', content: 'Typing…' }}
        handlers={handlers}
      />,
    );

    expect(screen.getByText('Typing…')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toHaveTextContent('loading-4');
  });

  it('shows a live widget bubble from tool preview', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Show orders', isUser: true, timestamp: new Date() }]}
        loading
        chunkCount={3}
        streamingPreview={{
          kind: 'widget',
          type: 'order_list',
          message: 'Here are your orders.',
          data: { orders: [{ orderId: 'EON1' }] },
        }}
        handlers={handlers}
      />,
    );

    expect(screen.getByText('Here are your orders.')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toHaveTextContent('loading-3');
  });

  it('shows live thinking status without raw chain-of-thought', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Show quotes', isUser: true, timestamp: new Date() }]}
        loading
        streamingPreview={{ kind: 'widget', type: 'quote_list', message: '', data: {} }}
        streamingThinking="active"
        handlers={handlers}
      />,
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('I will look up quotes.')).not.toBeInTheDocument();
    expect(screen.queryByText('thinking')).not.toBeInTheDocument();
  });

  it('uses a progress cursor over the chat log while the assistant is processing', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Question', isUser: true, timestamp: new Date() }]}
        loading
        processing
        handlers={handlers}
      />,
    );

    expect(screen.getByRole('log')).toHaveClass('cursor-progress');
    expect(screen.getByRole('log')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the spinner while loading without a preview', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Question', isUser: true, timestamp: new Date() }]}
        loading
        chunkCount={2}
        streamingPreview={null}
        handlers={handlers}
      />,
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('html-preview')).not.toBeInTheDocument();
  });

  it('keeps the widget preview after loading ends until an assistant message is committed', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Add to cart', isUser: true, timestamp: new Date() }]}
        loading={false}
        streamingPreview={{
          kind: 'widget',
          type: 'cart_summary',
          message: 'Added to cart.',
          data: { items: [{ productId: 'P1' }] },
        }}
        handlers={handlers}
      />,
    );

    expect(screen.getByText('Added to cart.')).toBeInTheDocument();
  });

  it('hides the preview once the committed assistant message exists', () => {
    render(
      <ChatMessages
        messages={[
          { id: '1', content: 'Add to cart', isUser: true, timestamp: new Date() },
          {
            id: '2',
            content: 'Added to cart.',
            isUser: false,
            timestamp: new Date(),
            type: 'cart_summary',
            data: { items: [{ productId: 'P1' }] },
          },
        ]}
        loading={false}
        streamingPreview={{
          kind: 'widget',
          type: 'cart_summary',
          message: 'Added to cart.',
          data: { items: [{ productId: 'P1' }] },
        }}
        handlers={handlers}
      />,
    );

    expect(screen.getAllByText('Added to cart.')).toHaveLength(1);
  });
});
