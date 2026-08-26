/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType, StructuredDataHandlers } from './types';

jest.mock('./StructuredDataRenderer', () => ({
  StructuredDataRenderer: ({ type }: { type: string }) => <div data-testid="structured-data">{type}</div>,
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

const handlers: StructuredDataHandlers = {
  setQuestionValue: jest.fn(),
  handleQuestionSubmit: jest.fn(),
};

function renderMessage(message: Partial<ChatMessageType> & Pick<ChatMessageType, 'content' | 'isUser'>) {
  return render(
    <ChatMessage
      handlers={handlers}
      message={{
        id: '1',
        timestamp: new Date('2026-08-14T10:00:00.000Z'),
        ...message,
      }}
    />,
  );
}

describe('ChatMessage', () => {
  it('shows the intro and nested data.message for type text', () => {
    renderMessage({
      isUser: false,
      type: 'text',
      content: 'Here are the highlights of the GreenCell High Performance Lithium Storage Battery TESTCHANGENAME:',
      data: {
        message: '• Made in Germany\n• High cycle stability\n• For dual power application',
        formatting: 'plain',
      },
    });

    expect(
      screen.getByText(
        'Here are the highlights of the GreenCell High Performance Lithium Storage Battery TESTCHANGENAME:',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Made in Germany/)).toBeInTheDocument();
    expect(screen.getByText(/High cycle stability/)).toBeInTheDocument();
    expect(screen.queryByTestId('structured-data')).not.toBeInTheDocument();
  });

  it('does not duplicate nested data.message when it matches the intro', () => {
    renderMessage({
      isUser: false,
      type: 'text',
      content: 'Hello',
      data: { message: 'Hello', formatting: 'plain' },
    });

    expect(screen.getAllByText('Hello')).toHaveLength(1);
  });

  it('renders widgets for non-text types', () => {
    renderMessage({
      isUser: false,
      type: 'order_list',
      content: 'Here are your current pending orders.',
      data: { orders: [] },
    });

    expect(screen.getByText('Here are your current pending orders.')).toBeInTheDocument();
    expect(screen.getByTestId('structured-data')).toHaveTextContent('order_list');
  });

  it('never paints leaked envelope JSON and falls back when the widget husk is unresolved', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    renderMessage({
      isUser: false,
      type: 'order_list',
      content:
        '{"agentId":"frontendAgent","sessionId":"abc","message":"Here are all your orders.","type":"order_list","data":{"orders":[',
      data: {},
    });

    expect(screen.queryByText(/agentId/)).not.toBeInTheDocument();
    expect(screen.getByText('Here are all your orders.')).toBeInTheDocument();
    expect(screen.getByTestId('structured-data')).toHaveTextContent('unrecognized');
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
