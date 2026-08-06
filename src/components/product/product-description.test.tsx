/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProductDescription } from './product-description';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/common/public-default-env', () => ({
  getPublicPdpDescriptionClampLines: () => 2,
  getPublicPdpDescriptionClampClass: (lines: number) => `line-clamp-${lines}`,
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
  },
}));

class ResizeObserverMock {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(): void {
    // no-op — tests drive measurement via window resize
  }

  unobserve(): void {}

  disconnect(): void {}
}

Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });

describe('ProductDescription', () => {
  it('applies the shared static line-clamp class when collapsed', () => {
    render(<ProductDescription html="<p>Short description</p>" />);

    const root = screen.getByTestId('product-description');
    expect(root).toHaveClass('gap-1');
    const content = root.firstElementChild;
    expect(content).toHaveClass('line-clamp-2');
    expect(content).toHaveAttribute('data-expanded', 'false');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sanitizes script tags before rendering HTML', () => {
    render(<ProductDescription html={'<p>Safe</p><script>alert(1)</script>'} />);

    const content = screen.getByTestId('product-description').firstElementChild;
    expect(content?.innerHTML).toContain('<p>Safe</p>');
    expect(content?.innerHTML).not.toContain('<script>');
  });

  it('shows the Show more toggle when content overflows and switches labels on expand/collapse', () => {
    render(<ProductDescription html="<p>Long product description that needs clamping across multiple lines.</p>" />);

    const content = screen.getByTestId('product-description').firstElementChild as HTMLDivElement;

    Object.defineProperty(content, 'scrollHeight', { configurable: true, get: () => 120 });
    Object.defineProperty(content, 'clientHeight', { configurable: true, get: () => 64 });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const toggle = screen.getByRole('button', { name: 'showMore' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(content).toHaveClass('line-clamp-2');
    expect(toggle).toHaveClass('font-bold', 'text-text-action', 'underline');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'showLess' })).toHaveAttribute('aria-expanded', 'true');
    expect(content).toHaveAttribute('data-expanded', 'true');
    expect(content).not.toHaveClass('line-clamp-2');

    fireEvent.click(screen.getByRole('button', { name: 'showLess' }));

    expect(screen.getByRole('button', { name: 'showMore' })).toHaveAttribute('aria-expanded', 'false');
    expect(content).toHaveClass('line-clamp-2');
  });

  it('does not render a toggle for short non-overflowing content', () => {
    render(<ProductDescription html="<p>Tiny</p>" />);

    const content = screen.getByTestId('product-description').firstElementChild as HTMLDivElement;
    Object.defineProperty(content, 'scrollHeight', { configurable: true, get: () => 32 });
    Object.defineProperty(content, 'clientHeight', { configurable: true, get: () => 64 });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(content).toHaveClass('line-clamp-2');
  });
});
