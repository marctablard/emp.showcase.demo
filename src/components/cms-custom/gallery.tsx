import dynamic from 'next/dynamic';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { sharedFieldDefinitions } from './_shared/field-definitions';
import type { GalleryColumns } from './gallery-client';

const Gallery = dynamic(() => import('./gallery-client'));

export const galleryEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-gallery',
    label: 'Gallery',
    description: 'Image gallery with optional lightbox.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      images: {
        label: 'Images',
        type: 'array',
        items: { $ref: 'image', label: 'Image', type: 'media', allowedTypes: ['image/*'] },
      },
      columns: {
        label: 'Columns',
        type: 'select',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
      gap: {
        label: 'Gap',
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      lightbox: { label: 'Enable lightbox', type: 'boolean' },
      aspect: {
        label: 'Tile aspect',
        type: 'select',
        options: [
          { label: 'Square', value: 'square' },
          { label: 'Video (16:9)', value: 'video' },
          { label: 'Auto (4:3)', value: 'auto' },
        ],
      },
    },
    defaultProps: { columns: '3', gap: 'md', lightbox: true, aspect: 'square' },
  },
  mapProps: (p) => ({
    images: p.images ?? [],
    columns: Number(p.columns) as GalleryColumns,
    gap: p.gap,
    lightbox: p.lightbox,
    aspect: p.aspect,
  }),
  component: Gallery,
};
