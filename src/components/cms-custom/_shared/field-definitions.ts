import type { CMSPropDefinition } from '@extensions/medienwerft-cms-plugin/types';

export const sharedFieldDefinitions: Record<string, CMSPropDefinition> = {
  image: {
    label: 'Image',
    type: 'object',
    properties: {
      filename: { label: 'Image URL', type: 'media', allowedTypes: ['image/*'], required: true },
      alt: { label: 'Alt text', type: 'text' },
    },
  },
  link: {
    label: 'Link',
    type: 'object',
    properties: {
      url: { label: 'URL', type: 'url' },
      label: { label: 'Label', type: 'text' },
      newTab: { label: 'Open in new tab', type: 'boolean' },
    },
  },
};

export type SharedImage = { filename: string; alt?: string };
export type SharedLink = { url: string; label?: string; newTab?: boolean };
