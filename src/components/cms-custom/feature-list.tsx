import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Bolt, Check, Heart, Leaf, type LucideIcon, Star } from 'lucide-react';
import { H2, H4 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { type Alignment, type Tone, alignClass, toneSurfaceClass } from './_shared/styles';

type Columns = 1 | 2 | 3 | 4 | 5;
type IconStyle = 'filled' | 'outline' | 'circle';
type IconKey = 'check' | 'star' | 'bolt' | 'heart' | 'leaf';

type Feature = {
  icon?: IconKey;
  title?: string;
  description?: string;
};

type FeatureListProps = {
  headline?: string;
  intro?: string;
  features?: Feature[];
  columns?: Columns;
  alignment?: Alignment;
  iconStyle?: IconStyle;
  tone?: Tone;
};

const iconMap: Record<IconKey, LucideIcon> = {
  check: Check,
  star: Star,
  bolt: Bolt,
  heart: Heart,
  leaf: Leaf,
};

const colClass = (c?: Columns) => {
  switch (c) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-1 md:grid-cols-2';
    case 4:
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    case 5:
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5';
    case 3:
    default:
      return 'grid-cols-1 md:grid-cols-3';
  }
};

export default function FeatureList({
  headline,
  intro,
  features = [],
  columns = 3,
  alignment = 'left',
  iconStyle = 'circle',
  tone = 'default',
}: FeatureListProps) {
  return (
    <section data-cms="feature-list" data-tone={tone} className={cn('w-full py-12', toneSurfaceClass(tone))}>
      <div className={cn('mx-auto flex max-w-6xl flex-col gap-8 px-6 md:px-12', alignClass(alignment))}>
        {headline ? <H2>{headline}</H2> : null}
        {intro ? <p className="max-w-prose text-base">{intro}</p> : null}
        <ul className={cn('grid w-full gap-8', colClass(columns))}>
          {features.map((f, i) => {
            const Icon = (f.icon && iconMap[f.icon]) || Check;
            return (
              <li key={i} className={cn('flex flex-col gap-3', alignClass(alignment))}>
                <div className="flex items-center gap-3">
                  <span
                    data-cms-field={`features.${i}.icon`}
                    data-icon-style={iconStyle}
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center text-icon-action',
                      iconStyle === 'circle' && 'rounded-full bg-surface-action-hover-2',
                      iconStyle === 'outline' && 'rounded-full border-2 border-border-action',
                    )}
                  >
                    <Icon size={24} strokeWidth={iconStyle === 'filled' ? 2.5 : 2} />
                  </span>
                  {f.title ? (
                    <H4 data-cms-field={`features.${i}.title`} className="text-text-headings">
                      {f.title}
                    </H4>
                  ) : null}
                </div>
                {f.description ? (
                  <p
                    data-cms-field={`features.${i}.description`}
                    className="whitespace-pre-line text-base text-text-body"
                  >
                    {f.description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export const featureListEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-feature-list',
    label: 'Feature list',
    description: 'A grid of features with icon, title, and description.',
    props: {
      headline: { label: 'Headline', type: 'text' },
      intro: { label: 'Intro', type: 'textarea' },
      features: {
        label: 'Features',
        type: 'array',
        items: {
          label: 'Feature',
          type: 'object',
          properties: {
            icon: {
              label: 'Icon',
              type: 'select',
              options: [
                { label: 'Check', value: 'check' },
                { label: 'Star', value: 'star' },
                { label: 'Bolt', value: 'bolt' },
                { label: 'Heart', value: 'heart' },
                { label: 'Leaf', value: 'leaf' },
              ],
            },
            title: { label: 'Title', type: 'text' },
            description: { label: 'Description', type: 'textarea' },
          },
        },
      },
      columns: {
        label: 'Columns',
        type: 'select',
        options: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
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
      icon_style: {
        label: 'Icon style',
        type: 'select',
        options: [
          { label: 'Filled', value: 'filled' },
          { label: 'Outline', value: 'outline' },
          { label: 'Circle', value: 'circle' },
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
    defaultProps: { columns: '3', alignment: 'left', icon_style: 'circle', tone: 'default' },
  },
  mapProps: (p) => ({
    headline: p.headline,
    intro: p.intro,
    features: p.features ?? [],
    columns: Number(p.columns) as Columns,
    alignment: p.alignment,
    iconStyle: p.icon_style,
    tone: p.tone,
  }),
  component: FeatureList,
};
