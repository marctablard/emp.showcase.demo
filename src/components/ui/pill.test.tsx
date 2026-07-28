/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Trash2 } from 'lucide-react';
import { Pill } from './pill';

describe('Pill', () => {
  it('keeps long labels wrapped inside the pill and leaves the icon trailing', () => {
    render(
      <Pill
        label="Very long filter label that should wrap inside the chip instead of overflowing out of the container"
        value="A second long value that should also wrap"
        trailingIcon={<Trash2 />}
        onClick={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', {
      name: /very long filter label that should wrap inside the chip instead of overflowing out of the container/i,
    });

    expect(button).toHaveClass('min-w-0');
    expect(button).toHaveClass('!whitespace-normal');
    expect(button.firstElementChild).toHaveClass('min-w-0', 'flex-1', 'flex-wrap');
    expect(button.lastElementChild?.querySelector('svg')).toBeInTheDocument();
  });
});
