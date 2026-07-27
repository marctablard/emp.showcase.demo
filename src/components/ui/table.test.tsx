/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { TableCard } from './table';

describe('TableCard', () => {
  it('applies the centralized Figma-aligned shadow token instead of the generic shadow-sm utility', () => {
    const { container } = render(<TableCard>content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(card).not.toHaveClass('shadow-sm');
  });

  it('keeps border, radius, and responsive padding unchanged alongside the shadow token', () => {
    const { container } = render(<TableCard>content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).toHaveClass('p-4', 'min-[768px]:p-6');
  });

  it('does not add a domain-specific shadow override when a caller passes an additional className', () => {
    const { container } = render(<TableCard className="extra-class">content</TableCard>);

    const card = container.querySelector('[data-slot="table-card"]');
    expect(card).toHaveClass('shadow-[var(--theme-shadow-sm)]', 'extra-class');
    expect(card).not.toHaveClass('shadow-sm');
  });
});
