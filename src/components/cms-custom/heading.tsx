import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Heading, Overline } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { type Alignment, type Tone, alignClass } from './_shared/styles';

type Level = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type HeadingBlockProps = {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  level?: Level;
  alignment?: Alignment;
  tone?: Exclude<Tone, 'inverted'>;
};

const toneTextClass = (tone?: HeadingBlockProps['tone']) => {
  switch (tone) {
    case 'muted':
      return 'text-text-placeholders';
    case 'accent':
      return 'text-text-action';
    case 'default':
    default:
      return 'text-text-headings';
  }
};

export default function HeadingBlock({
  eyebrow,
  headline,
  subheadline,
  level = 'h2',
  alignment = 'left',
  tone = 'default',
}: HeadingBlockProps) {
  return (
    <div data-cms="heading" data-tone={tone} className={cn('flex flex-col gap-2 px-6 md:px-12', alignClass(alignment))}>
      {eyebrow ? <Overline>{eyebrow}</Overline> : null}
      {headline ? (
        <Heading variant={level} as={level} className={toneTextClass(tone)}>
          {headline}
        </Heading>
      ) : null}
      {subheadline ? <p className="text-base text-text-body">{subheadline}</p> : null}
    </div>
  );
}

export const headingEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-heading',
    label: 'Heading',
    description: 'Standalone headline, optionally with an eyebrow and subheadline.',
    props: {
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text', required: true },
      subheadline: { label: 'Subheadline', type: 'textarea' },
      level: {
        label: 'Level',
        type: 'select',
        options: [
          { label: 'H1', value: 'h1' },
          { label: 'H2', value: 'h2' },
          { label: 'H3', value: 'h3' },
          { label: 'H4', value: 'h4' },
          { label: 'H5', value: 'h5' },
          { label: 'H6', value: 'h6' },
        ],
      },
      alignment: {
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
        ],
      },
    },
    defaultProps: { level: 'h2', alignment: 'left', tone: 'default' },
  },
  mapProps: (p) => ({
    eyebrow: p.eyebrow,
    headline: p.headline,
    subheadline: p.subheadline,
    level: p.level,
    alignment: p.alignment,
    tone: p.tone,
  }),
  component: HeadingBlock,
};
