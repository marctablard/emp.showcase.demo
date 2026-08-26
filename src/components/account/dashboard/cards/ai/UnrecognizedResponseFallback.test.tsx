/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { UnrecognizedResponseFallback } from './UnrecognizedResponseFallback';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('UnrecognizedResponseFallback', () => {
  it('shows the three-line preview and the console hint', () => {
    render(
      <UnrecognizedResponseFallback
        data={{
          previewJson: '{\n  "orders": [],\n  "page": 1',
        }}
      />,
    );

    expect(screen.getByText(/"orders": \[\]/)).toBeInTheDocument();
    expect(screen.getByText('unrecognizedResponseHint')).toBeInTheDocument();
    expect(screen.queryByText(/agentId/)).not.toBeInTheDocument();
  });
});
