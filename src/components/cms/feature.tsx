'use client';

import { storyblokEditable } from '@storyblok/react/rsc';
import { Heading } from '../ui/h';

/**
 * Feature component for Storyblok
 * Renders a feature block with name and description
 */
interface FeatureProps {
  blok: {
    name: string;
    description: string;
  };
}

const Feature = ({ blok }: FeatureProps) => {
  return (
    <div {...storyblokEditable(blok)} className="p-6 border rounded-md shadow-sm">
      <Heading variant="h3" as="div">
        {blok.name}
      </Heading>
      <p className="text-text-on-disabled">{blok.description}</p>
    </div>
  );
};

export default Feature;
