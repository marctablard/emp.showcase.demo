import { cn } from '@/lib/utils';

export type Alignment = 'left' | 'center' | 'right';
export type Tone = 'default' | 'muted' | 'accent' | 'inverted';
export type MaxWidth = 'narrow' | 'content' | 'wide' | 'full';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'full';

export const alignClass = (alignment?: Alignment) => {
  switch (alignment) {
    case 'center':
      return 'text-center items-center';
    case 'right':
      return 'text-right items-end';
    default:
      return 'text-left items-start';
  }
};

export const justifyClass = (alignment?: Alignment) => {
  switch (alignment) {
    case 'center':
      return 'justify-center';
    case 'right':
      return 'justify-end';
    default:
      return 'justify-start';
  }
};

export const maxWidthClass = (maxWidth?: MaxWidth) => {
  switch (maxWidth) {
    case 'narrow':
      return 'max-w-2xl mx-auto';
    case 'wide':
      return 'max-w-7xl mx-auto';
    case 'full':
      return 'w-full';
    case 'content':
    default:
      return 'max-w-5xl mx-auto';
  }
};

export const densityClass = (density?: Density) => {
  switch (density) {
    case 'compact':
      return 'py-4 md:py-6';
    case 'spacious':
      return 'py-16 md:py-24';
    case 'comfortable':
    default:
      return 'py-8 md:py-12';
  }
};

export const radiusClass = (radius?: Radius) => {
  switch (radius) {
    case 'none':
      return 'rounded-none';
    case 'sm':
      return 'rounded-sm';
    case 'lg':
      return 'rounded-lg';
    case 'full':
      return 'rounded-full';
    case 'md':
    default:
      return 'rounded-md';
  }
};

/**
 * Map a tone to surface + text classes that resolve to existing host theme
 * tokens so the CMS theme editor can override them.
 */
export const toneSurfaceClass = (tone?: Tone) => {
  switch (tone) {
    case 'muted':
      return 'bg-surface-secondary text-text-body';
    case 'accent':
      return 'bg-surface-action text-text-on-action';
    case 'inverted':
      return 'bg-surface-neutral text-text-on-action';
    case 'default':
    default:
      return 'bg-surface-page text-text-body';
  }
};

export const cmsClass = cn;
