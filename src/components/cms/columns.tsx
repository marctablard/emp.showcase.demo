'use client';

import { StoryblokServerComponent, storyblokEditable } from '@storyblok/react/rsc';

/**
 * Columns component for Storyblok
 * Renders a flexible column layout with nested components
 */
interface ColumnsProps {
  blok: {
    columns?: any[];
  };
}

const Columns = ({ blok }: ColumnsProps) => {
  return (
    <div {...storyblokEditable(blok)} className="flex flex-col sm:flex-row gap-4">
      {blok.columns?.map((nestedBlok) => (
        <div key={nestedBlok._uid} className="flex-1">
          <StoryblokServerComponent blok={nestedBlok} />
        </div>
      ))}
    </div>
  );
};

export default Columns;
