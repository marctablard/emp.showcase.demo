import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Divider = 'none' | 'line' | 'dotted';

type SpacerProps = {
  size?: Size;
  divider?: Divider;
};

const sizeClass = (size?: Size) => {
  switch (size) {
    case 'xs':
      return 'py-2';
    case 'sm':
      return 'py-4';
    case 'lg':
      return 'py-12';
    case 'xl':
      return 'py-20';
    case 'md':
    default:
      return 'py-8';
  }
};

export default function Spacer({ size = 'md', divider = 'none' }: SpacerProps) {
  return (
    <div data-cms="spacer" className={cn('w-full', sizeClass(size))} aria-hidden>
      {divider !== 'none' ? (
        <span
          className={cn(
            'mx-auto block w-full max-w-5xl border-border-primary',
            divider === 'line' ? 'border-t' : 'border-t border-dotted',
          )}
        />
      ) : null}
    </div>
  );
}

export const spacerEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-spacer',
    label: 'Spacer',
    description: 'Vertical spacing with an optional divider line.',
    props: {
      size: {
        label: 'Size',
        type: 'select',
        options: [
          { label: 'Extra small', value: 'xs' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
          { label: 'Extra large', value: 'xl' },
        ],
      },
      divider: {
        label: 'Divider',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Line', value: 'line' },
          { label: 'Dotted', value: 'dotted' },
        ],
      },
    },
    defaultProps: { size: 'md', divider: 'none' },
  },
  mapProps: (p) => ({ size: p.size, divider: p.divider }),
  component: Spacer,
};
