'use client';

import { storyblokEditable } from '@storyblok/react/rsc';
import { H2 } from '@/components/ui/h';

/**
 * Teaser component for Storyblok
 * Displays a simple teaser with headline
 */
interface TeaserProps {
  blok: {
    headline?: string;
  };
}

const Teaser = ({ blok }: TeaserProps) => {
  return (
    <div {...storyblokEditable(blok)} className="p-6 bg-surface-disabled rounded-md shadow-sm text-center mb-6">
      <H2 variant="h6" className="mb-4">
        {blok.headline || 'Hello world!'}
      </H2>
    </div>
  );
};

export default Teaser;
