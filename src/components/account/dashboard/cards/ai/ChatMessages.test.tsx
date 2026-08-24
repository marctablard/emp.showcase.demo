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
  LoadingIndicator: () => <div data-testid="loading-indicator">loading</div>,
}));

const handlers: StructuredDataHandlers = {
  setQuestionValue: jest.fn(),
  handleQuestionSubmit: jest.fn(),
};

describe('ChatMessages', () => {
  it('shows a live preview bubble instead of the spinner when preview is available', () => {
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
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('shows live thinking without replacing a widget preview', () => {
    render(
      <ChatMessages
        messages={[{ id: '1', content: 'Show quotes', isUser: true, timestamp: new Date() }]}
        loading
        streamingPreview={{ kind: 'widget', type: 'quote_list', message: '', data: {} }}
        streamingThinking="I will look up quotes."
        handlers={handlers}
      />,
    );

    expect(screen.getByText('thinking')).toBeInTheDocument();
    expect(screen.getByText('I will look up quotes.')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
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
});
