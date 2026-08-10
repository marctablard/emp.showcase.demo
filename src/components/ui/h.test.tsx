/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { H1, H2, H3, H4, H5, H6, Heading, Overline } from './h';

describe('Heading components (Figma token defaults)', () => {
  it.each([
    ['H1', H1, 'h1', 'text-7xl'],
    ['H2', H2, 'h2', 'text-6xl'],
    ['H3', H3, 'h3', 'text-5xl'],
    ['H4', H4, 'h4', 'text-4xl'],
    ['H5', H5, 'h5', 'text-3xl'],
    ['H6', H6, 'h6', 'text-2xl'],
  ] as const)('%s applies Figma heading token utilities by default', (_name, Component, tag, sizeClass) => {
    render(<Component>Title</Component>);
    const heading = screen.getByText('Title');
    expect(heading.tagName).toBe(tag.toUpperCase());
    expect(heading).toHaveClass('font-headlines', 'font-bold', 'text-text-headings', sizeClass);
  });

  it('lets className override default token utilities', () => {
    render(<H5 className="text-sm font-normal">Override</H5>);
    const heading = screen.getByText('Override');
    expect(heading).toHaveClass('text-sm', 'font-normal');
    expect(heading).not.toHaveClass('text-3xl');
    expect(heading).not.toHaveClass('font-bold');
  });

  it('keeps overline defaults and allows Heading variant reuse', () => {
    render(<Overline>Label</Overline>);
    expect(screen.getByText('Label')).toHaveClass('text-xl', 'uppercase', 'tracking-widest');

    render(
      <Heading variant="h5" as="h2">
        Looks like H5
      </Heading>,
    );
    const heading = screen.getByText('Looks like H5');
    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveClass('text-3xl');
  });
});
