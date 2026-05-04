import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';
import { type Alignment, type MaxWidth, alignClass, maxWidthClass } from './_shared/styles';

type ProseSize = 'sm' | 'base' | 'lg';

type RichTextProps = {
  body?: string;
  alignment?: Alignment;
  maxWidth?: MaxWidth;
  proseSize?: ProseSize;
};

const proseClass = (size?: ProseSize) => {
  switch (size) {
    case 'sm':
      return 'text-sm';
    case 'lg':
      return 'text-lg';
    case 'base':
    default:
      return 'text-base';
  }
};

export default function RichText({
  body = '',
  alignment = 'left',
  maxWidth = 'content',
  proseSize = 'base',
}: RichTextProps) {
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  return (
    <div
      data-cms="rich-text"
      className={cn('flex flex-col gap-4 px-6 md:px-12', maxWidthClass(maxWidth), alignClass(alignment))}
    >
      {paragraphs.map((p, i) => (
        <p key={i} className={cn(proseClass(proseSize), 'whitespace-pre-line text-text-body')}>
          {p}
        </p>
      ))}
    </div>
  );
}

export const richTextEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-rich-text',
    label: 'Rich text',
    description: 'A block of body copy. Paragraphs are separated by blank lines.',
    props: {
      body: { label: 'Body', type: 'textarea', required: true },
      alignment: {
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      max_width: {
        label: 'Max width',
        type: 'select',
        options: [
          { label: 'Narrow', value: 'narrow' },
          { label: 'Content', value: 'content' },
          { label: 'Wide', value: 'wide' },
          { label: 'Full', value: 'full' },
        ],
      },
      prose_size: {
        label: 'Prose size',
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Base', value: 'base' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: { alignment: 'left', max_width: 'content', prose_size: 'base' },
  },
  mapProps: (p) => ({
    body: p.body,
    alignment: p.alignment,
    maxWidth: p.max_width,
    proseSize: p.prose_size,
  }),
  component: RichText,
};
