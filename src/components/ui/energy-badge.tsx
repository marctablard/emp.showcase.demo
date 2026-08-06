import type { HTMLAttributes, JSX } from 'react';
import { cn } from '@/lib/utils';

/**
 * Figma Molecules / Energy badge (`12830:188906`) — green pointed shield with
 * white energy-class letter(s). Fill uses `colors/icon/success` (#08891e).
 */
interface EnergyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  rating: string;
}

const ENERGY_BADGE_PATH =
  'M0 4C0 1.79086 1.79086 0 4 0H48.4553C49.7607 0 50.984 0.636961 51.7325 1.70643L58.7312 11.7064C59.695 13.0836 59.695 14.9164 58.7312 16.2936L51.7325 26.2936C50.984 27.363 49.7607 28 48.4553 28H4C1.79086 28 0 26.2091 0 24V4Z';

export function EnergyBadge({ rating, className, ...props }: EnergyBadgeProps): JSX.Element {
  return (
    <span
      role="img"
      aria-label={rating}
      className={cn('relative inline-flex h-7 min-w-15 items-center justify-start pl-2 pr-5', className)}
      {...props}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full text-icon-success"
        viewBox="0 0 60 28"
        preserveAspectRatio="none"
      >
        <path d={ENERGY_BADGE_PATH} fill="currentColor" />
      </svg>
      {/* Figma Energy letter uses Inter 14/20 semibold; closest body token is text-sm */}
      <span className="relative z-10 text-sm font-semibold leading-5 text-text-on-action">{rating}</span>
    </span>
  );
}
