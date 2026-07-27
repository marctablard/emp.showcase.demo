/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MarkedText } from './marked-text';

describe('MarkedText', () => {
  it('renders pre-highlighted text correctly when keyword is empty', () => {
    const text = 'Electrical supplies > Power generation > <mark>Solar</mark> panels';
    render(<MarkedText text={text} keyword="" />);

    expect(screen.getByText('Solar')).toHaveClass('font-bold');
    // Ensure the non-highlighted text is rendered
    expect(
      screen.getByText((content) => content.startsWith('Electrical supplies > Power generation >')),
    ).toBeInTheDocument();

    // Test the text content inside the container
    expect(screen.getByText('Solar').parentElement?.textContent).toBe(
      'Electrical supplies > Power generation > Solar panels',
    );

    // Ensure no <mark> tag is literally visible
    expect(screen.queryByText(/<mark>/)).not.toBeInTheDocument();
  });

  it('renders keyword-highlighted text correctly when keyword is provided', () => {
    render(<MarkedText text="solaranlage" keyword="solar" />);

    expect(screen.getByText('solar')).toHaveClass('font-bold');
    expect(screen.getByText('anlage')).toBeInTheDocument();
  });
});
