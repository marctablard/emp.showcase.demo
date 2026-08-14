/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { LoadingIndicator } from './LoadingIndicator';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { numberOfChunks?: number }) => {
    if (key === 'thinkingWithChunks') {
      return `AI is thinking. Chunks generated: ${values?.numberOfChunks}`;
    }
    if (key === 'thinking') {
      return 'AI is thinking...';
    }
    if (key === 'aiProcessing') {
      return 'AI is processing your request';
    }
    return key;
  },
}));

describe('LoadingIndicator', () => {
  it('shows the thinking copy without a chunk count by default', () => {
    render(<LoadingIndicator />);
    expect(screen.getByText('AI is thinking...')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('AI is processing your request')).toBeInTheDocument();
  });

  it('shows a live chunk count when progress is available', () => {
    render(<LoadingIndicator chunkCount={12} />);
    expect(screen.getByText('AI is thinking. Chunks generated: 12')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('AI is processing your request')).toBeInTheDocument();
  });
});
