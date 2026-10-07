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
    const spinner = ring?.firstElementChild;
    const fill = frame.querySelector('[data-slot="skeleton-frame-fill"]');

    expect(frame).toHaveAttribute('data-slot', 'skeleton-frame');
    expect(frame).toHaveAttribute('data-motion', 'spin');
    expect(frame).toHaveClass('skeleton-border-width', 'bg-clip-padding');
    expect(ring).toHaveClass('skeleton-border-spinner', 'skeleton-border-ring');
    expect(spinner).toHaveClass(
      'skeleton-border-spin-layer',
      'skeleton-border-spin-fill',
      'animate-skeleton-border-spin',
    );
    expect(fill).toHaveClass('animate-pulse', 'bg-surface-hover-grey');
    expect(fill).toHaveClass('rounded-[calc(var(--radius-xl)-0.175rem)]');
  });

  it('supports a shifting gradient border and optional pulse off', () => {
    render(<SkeletonFrame data-testid="frame" motion="shift" pulse={false} className="h-16" />);

    const frame = screen.getByTestId('frame');
    const ring = frame.querySelector('[aria-hidden]');
    const fill = frame.querySelector('[data-slot="skeleton-frame-fill"]');

    expect(frame).toHaveAttribute('data-motion', 'shift');
    expect(ring?.firstElementChild).toHaveClass('animate-skeleton-border');
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
