import type { ReactNode } from 'react';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { H2, Overline } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import {
  type Alignment,
  type Density,
  type MaxWidth,
  type Tone,
  alignClass,
  densityClass,
  maxWidthClass,
  toneSurfaceClass,
} from './_shared/styles';

type SectionProps = {
  eyebrow?: string;
  headline?: string;
  body?: string;
  alignment?: Alignment;
  maxWidth?: MaxWidth;
  tone?: Tone;
  padding?: Density;
  children?: ReactNode;
};

export default function Section({
  eyebrow,
  headline,
  body,
  alignment = 'left',
  maxWidth = 'content',
  tone = 'default',
  padding = 'comfortable',
  children,
}: SectionProps) {
  return (
    <section
      data-cms="section"
      data-tone={tone}
      className={cn('w-full', toneSurfaceClass(tone), densityClass(padding))}
    >
      <div className={cn('flex flex-col gap-6 px-6 md:px-12', maxWidthClass(maxWidth), alignClass(alignment))}>
        {eyebrow ? <Overline>{eyebrow}</Overline> : null}
        {headline ? <H2>{headline}</H2> : null}
        {body ? <p className="max-w-prose whitespace-pre-line text-base">{body}</p> : null}
        {children}
      </div>
    </section>
  );
}

export const sectionEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-section',
    label: 'Section',
    description: 'Section wrapper with optional headline/body and a content area for nested components.',
    props: {
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text' },
      body: { label: 'Body', type: 'textarea' },
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
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
          { label: 'Inverted', value: 'inverted' },
        ],
      },
      padding: {
        label: 'Padding',
        type: 'select',
        options: [
          { label: 'Compact', value: 'compact' },
          { label: 'Comfortable', value: 'comfortable' },
          { label: 'Spacious', value: 'spacious' },
        ],
      },
    },
    defaultProps: {
      alignment: 'left',
      max_width: 'content',
      tone: 'default',
      padding: 'comfortable',
    },
  },
  mapProps: (p) => ({
    eyebrow: p.eyebrow,
    headline: p.headline,
    body: p.body,
    alignment: p.alignment,
    maxWidth: p.max_width,
    tone: p.tone,
    padding: p.padding,
  }),
  component: Section,
};
