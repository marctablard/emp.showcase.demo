/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SkeletonFrame } from './skeleton-frame';

describe('SkeletonFrame', () => {
  it('pulses the fill and keeps the spinning gradient in a border ring', () => {
    render(<SkeletonFrame data-testid="frame" className="h-24" />);

    const frame = screen.getByTestId('frame');
    const ring = frame.querySelector('[aria-hidden]');
    const fill = frame.querySelector('[data-slot="skeleton-frame-fill"]');

    expect(frame).toHaveAttribute('data-slot', 'skeleton-frame');
    expect(frame).toHaveAttribute('data-motion', 'spin');
    expect(ring).toHaveClass('skeleton-border-ring', 'skeleton-border-spin-fill', 'animate-skeleton-border-spin');
    expect(ring?.childElementCount).toBe(0);
    expect(fill).toHaveClass('animate-pulse', 'bg-surface-hover-grey');
  });

  it('supports a shifting gradient border and optional pulse off', () => {
    render(<SkeletonFrame data-testid="frame" motion="shift" pulse={false} className="h-16" />);

    const frame = screen.getByTestId('frame');
    const ring = frame.querySelector('[aria-hidden]');
    const fill = frame.querySelector('[data-slot="skeleton-frame-fill"]');

    expect(frame).toHaveAttribute('data-motion', 'shift');
    expect(ring).toHaveClass('animate-skeleton-border', 'skeleton-border-ring');
    expect(fill).not.toHaveClass('animate-pulse');
  });

  it('can render without an animated border', () => {
    render(<SkeletonFrame data-testid="frame" animatedBorder={false} />);

    expect(screen.getByTestId('frame')).toHaveAttribute('data-motion', 'none');
    expect(screen.getByTestId('frame').querySelector('[aria-hidden]')).not.toBeInTheDocument();
    expect(screen.getByTestId('frame').querySelector('[data-slot="skeleton-frame-fill"]')).toHaveClass(
      'bg-surface-hover-grey',
    );
  });
});
