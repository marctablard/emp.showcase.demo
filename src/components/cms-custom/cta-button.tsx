import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SharedLink, linkHref, sharedFieldDefinitions } from './_shared/field-definitions';
import { type Alignment, justifyClass } from './_shared/styles';

type Variant = 'primary' | 'secondary' | 'neutral' | 'link';
type Size = 'sm' | 'md' | 'lg';

type CtaButtonProps = {
  link?: SharedLink;
  variant?: Variant;
  size?: Size;
  alignment?: Alignment;
  fullWidth?: boolean;
};

const sizeClass = (s?: Size) => (s === 'sm' ? 'text-sm py-2 px-3' : s === 'lg' ? 'text-lg py-4 px-6' : '');

export default function CtaButton({
  link,
  variant = 'primary',
  size = 'md',
  alignment = 'left',
  fullWidth = false,
}: CtaButtonProps) {
  const href = linkHref(link);
  if (!href) return null;
  return (
    <div data-cms="cta-button" className={cn('flex w-full px-6 md:px-12', justifyClass(alignment))}>
      <Button asChild variant={variant} className={cn(sizeClass(size), fullWidth && 'w-full')}>
        <Link href={href} target={link?.newTab ? '_blank' : undefined}>
          {link?.label ?? 'Learn more'}
        </Link>
      </Button>
    </div>
  );
}

export const ctaButtonEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-cta-button',
    label: 'CTA button',
    description: 'A single call-to-action button.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      link: { $ref: 'link', label: 'Link', type: 'object', required: true },
      variant: {
        label: 'Variant',
        type: 'select',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Link', value: 'link' },
        ],
      },
      size: {
        label: 'Size',
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
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
      full_width: { label: 'Full width', type: 'boolean' },
    },
    defaultProps: { variant: 'primary', size: 'md', alignment: 'left', full_width: false },
  },
  mapProps: (p) => ({
    link: p.link,
    variant: p.variant,
    size: p.size,
    alignment: p.alignment,
    fullWidth: p.full_width,
  }),
  component: CtaButton,
};
