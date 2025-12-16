'use client';

import { StoryblokServerComponent, storyblokEditable } from '@storyblok/react/rsc';

/**
 * Grid component for Storyblok
 * A container component that renders child components in a grid layout
 */
interface GridProps {
  blok: {
    columns?: any[];
  };
}

const Grid = ({ blok }: GridProps) => {
  return (
    <div {...storyblokEditable(blok)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {blok.columns?.map((nestedBlok) => (
        <StoryblokServerComponent blok={nestedBlok} key={nestedBlok._uid} />
      ))}
    </div>
  );
};

export default Grid;
